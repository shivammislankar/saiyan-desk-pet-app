import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { TodoService } from "../../src/services/todo-service";

const item = (over: Partial<{ id: string; text: string; done: boolean; createdAt: number }> = {}) => ({
  id: "a1",
  text: "Write tests",
  done: false,
  createdAt: 1,
  ...over,
});

describe("TodoService", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("starts empty when there is no file", () => {
    expect(new TodoService(dir).load()).toEqual([]);
  });

  it("saves and reloads a list", () => {
    const svc = new TodoService(dir);
    const result = svc.save([item(), item({ id: "b2", text: "Ship it", done: true })]);
    expect(result.success).toBe(true);
    const reloaded = new TodoService(dir).load();
    expect(reloaded.map((t) => t.text)).toEqual(["Write tests", "Ship it"]);
    expect(fs.existsSync(path.join(dir, "todos.json.tmp"))).toBe(false);
  });

  it("rejects invalid input without touching the saved list", () => {
    const svc = new TodoService(dir);
    svc.save([item()]);
    expect(svc.save([item({ text: "" })]).success).toBe(false);
    expect(svc.save([item({ id: "../evil" })]).success).toBe(false);
    expect(svc.save([item({ text: "x".repeat(201) })]).success).toBe(false);
    expect(svc.save("not a list").success).toBe(false);
    expect(new TodoService(dir).load()).toHaveLength(1);
  });

  it("caps the number of items", () => {
    const many = Array.from({ length: 201 }, (_, i) => item({ id: `id${i}` }));
    expect(new TodoService(dir).save(many).success).toBe(false);
  });

  it("backs up a corrupt file and starts empty", () => {
    fs.writeFileSync(path.join(dir, "todos.json"), "{ not json");
    expect(new TodoService(dir).load()).toEqual([]);
    expect(fs.readFileSync(path.join(dir, "todos.json.bak"), "utf-8")).toBe("{ not json");
    fs.writeFileSync(path.join(dir, "todos.json"), JSON.stringify([{ bogus: true }]));
    expect(new TodoService(dir).load()).toEqual([]);
    expect(fs.existsSync(path.join(dir, "todos.json.bak"))).toBe(true);
  });
});
