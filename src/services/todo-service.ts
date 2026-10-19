/**
 * To-do service: the list shown when the pet is clicked.
 * Stored as todos.json in the data directory, validated on load and save,
 * written atomically (temp file + rename). No Electron imports, so it is
 * unit-testable on its own.
 */

import * as fs from "fs";
import * as path from "path";
import { todoListSchema, type TodoItem } from "../shared/schemas";

export class TodoService {
  private filePath: string;
  private todos: TodoItem[] = [];

  constructor(dataDirectory: string) {
    this.filePath = path.join(dataDirectory, "todos.json");
  }

  /**
   * Load from disk. A missing file is an empty list; a corrupt file is kept
   * as todos.json.bak and the list starts empty, so nothing is silently lost.
   */
  load(): TodoItem[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.todos = [];
        return this.getTodos();
      }
      let raw: unknown = null;
      try {
        raw = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      } catch {
        raw = null; // unreadable JSON is handled as invalid below
      }
      const result = todoListSchema.safeParse(raw);
      if (result.success) {
        this.todos = result.data;
      } else {
        console.warn("todos.json is invalid; keeping a backup and starting empty");
        fs.copyFileSync(this.filePath, `${this.filePath}.bak`);
        this.todos = [];
      }
    } catch (error) {
      console.error("Failed to load todos:", error);
      this.todos = [];
    }
    return this.getTodos();
  }

  getTodos(): TodoItem[] {
    return this.todos.map((t) => ({ ...t }));
  }

  /**
   * Replace the whole list after validating it (input comes from a renderer).
   */
  save(input: unknown): { success: true; todos: TodoItem[] } | { success: false; error: string } {
    const result = todoListSchema.safeParse(input);
    if (!result.success) {
      return { success: false, error: result.error.issues[0]?.message ?? "Invalid to-do list" };
    }
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(result.data, null, 2), "utf-8");
      fs.renameSync(tempPath, this.filePath);
      this.todos = result.data;
      return { success: true, todos: this.getTodos() };
    } catch (error) {
      console.error("Failed to save todos:", error);
      return { success: false, error: "Could not save the to-do list" };
    }
  }
}
