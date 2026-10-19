/**
 * Settings UI controller.
 * Handles user interaction with the settings window.
 */

declare const gokuPetAPI: {
  getSettings: () => Promise<{ settings: Record<string, unknown> }>;
  saveSettings: (settings: unknown) => Promise<{ success: boolean; error?: string }>;
  getPacks: () => Promise<{ packs: Array<{ id: string; name: string }>; active: string }>;
  selectPack: (packId: string) => Promise<{ success: boolean; error?: string }>;
};

class SettingsUI {
  private settings: Record<string, unknown> = {};

  async initialize(): Promise<void> {
    // Load current settings
    const result = await gokuPetAPI.getSettings();
    this.settings = result.settings;

    // Set up tab switching
    this.setupTabs();

    // Populate form
    this.populateForm();

    // Load packs
    await this.loadPacks();

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupTabs(): void {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        // Remove active class from all tabs and contents
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

        // Add active class to clicked tab and corresponding content
        tab.classList.add("active");
        const tabName = (tab as HTMLElement).dataset.tab;
        const content = document.getElementById(`tab-${tabName}`);
        if (content) content.classList.add("active");
      });
    });
  }

  private populateForm(): void {
    // Scale
    const scaleInput = document.getElementById("scale") as HTMLInputElement;
    const scaleValue = document.getElementById("scale-value")!;
    scaleInput.value = String(this.settings.scale || 2);
    scaleValue.textContent = String(this.settings.scale || 2);

    // Opacity
    const opacityInput = document.getElementById("opacity") as HTMLInputElement;
    const opacityValue = document.getElementById("opacity-value")!;
    const opacity = Number(this.settings.opacity || 1);
    opacityInput.value = String(opacity);
    opacityValue.textContent = String(Math.round(opacity * 100));

    // Colors
    const outfitColor = document.getElementById("outfit-color") as HTMLInputElement;
    outfitColor.value = String(this.settings.outfitColor || "#FF6600");

    const hairColor = document.getElementById("hair-color") as HTMLInputElement;
    hairColor.value = String(this.settings.hairColor || "#000000");

    // Checkboxes
    const checkboxes = [
      "start-at-login",
      "keyboard-combat",
      "mouse-hunt",
      "petting",
      "scroll-reactions",
      "kaioken",
      "gravity",
    ];
    for (const id of checkboxes) {
      const checkbox = document.getElementById(id) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = Boolean(this.settings[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]);
      }
    }

    // Nimbus mode
    const nimbusMode = document.getElementById("nimbus-mode") as HTMLSelectElement;
    nimbusMode.value = String(this.settings.nimbusMode || "when-idle");

    // Reminders
    const stretchInterval = document.getElementById("stretch-interval") as HTMLInputElement;
    stretchInterval.value = String(this.settings.stretchReminderInterval || 45);

    const waterInterval = document.getElementById("water-interval") as HTMLInputElement;
    waterInterval.value = String(this.settings.waterReminderInterval || 60);
  }

  private async loadPacks(): Promise<void> {
    const select = document.getElementById("sprite-pack") as HTMLSelectElement;
    try {
      const result = await gokuPetAPI.getPacks();
      for (const pack of result.packs) {
        const option = document.createElement("option");
        option.value = pack.id;
        option.textContent = pack.name;
        select.appendChild(option);
      }
      select.value = result.active;
    } catch (error) {
      console.error("Failed to load packs:", error);
    }
  }

  private setupEventListeners(): void {
    // Scale slider
    const scaleInput = document.getElementById("scale") as HTMLInputElement;
    const scaleValue = document.getElementById("scale-value")!;
    scaleInput.addEventListener("input", () => {
      scaleValue.textContent = scaleInput.value;
    });

    // Opacity slider
    const opacityInput = document.getElementById("opacity") as HTMLInputElement;
    const opacityValue = document.getElementById("opacity-value")!;
    opacityInput.addEventListener("input", () => {
      opacityValue.textContent = String(Math.round(Number(opacityInput.value) * 100));
    });

    // Save button
    const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
    saveBtn.addEventListener("click", () => this.saveSettings());

    // Reset button
    const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
    resetBtn.addEventListener("click", () => this.resetSettings());
  }

  private async saveSettings(): Promise<void> {
    const status = document.getElementById("status")!;

    try {
      const settings = this.collectSettings();
      const result = await gokuPetAPI.saveSettings(settings);

      if (result.success) {
        status.textContent = "Settings saved successfully";
        status.style.color = "#4CAF50";
      } else {
        status.textContent = `Error: ${result.error}`;
        status.style.color = "#f44336";
      }
    } catch (error) {
      status.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
      status.style.color = "#f44336";
    }
  }

  private async resetSettings(): Promise<void> {
    if (!confirm("Reset all settings to defaults?")) return;

    const defaults = {
      scale: 2,
      opacity: 1,
      outfitColor: "#FF6600",
      hairColor: "#000000",
      nimbusMode: "when-idle",
      gravity: false,
      mouseHunt: true,
      petting: true,
      scrollReactions: true,
      keyboardCombat: true,
      kaioken: true,
      startAtLogin: false,
      stretchReminderInterval: 45,
      waterReminderInterval: 60,
    };

    const result = await gokuPetAPI.saveSettings(defaults);
    if (result.success) {
      this.settings = defaults;
      this.populateForm();
      const status = document.getElementById("status")!;
      status.textContent = "Settings reset to defaults";
      status.style.color = "#4CAF50";
    }
  }

  private collectSettings(): Record<string, unknown> {
    const settings: Record<string, unknown> = {};

    // Scale
    const scaleInput = document.getElementById("scale") as HTMLInputElement;
    settings.scale = Number(scaleInput.value);

    // Opacity
    const opacityInput = document.getElementById("opacity") as HTMLInputElement;
    settings.opacity = Number(opacityInput.value);

    // Colors
    const outfitColor = document.getElementById("outfit-color") as HTMLInputElement;
    settings.outfitColor = outfitColor.value;

    const hairColor = document.getElementById("hair-color") as HTMLInputElement;
    settings.hairColor = hairColor.value;

    // Checkboxes
    const checkboxes = [
      "start-at-login",
      "keyboard-combat",
      "mouse-hunt",
      "petting",
      "scroll-reactions",
      "kaioken",
      "gravity",
    ];
    for (const id of checkboxes) {
      const checkbox = document.getElementById(id) as HTMLInputElement;
      if (checkbox) {
        const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        settings[key] = checkbox.checked;
      }
    }

    // Nimbus mode
    const nimbusMode = document.getElementById("nimbus-mode") as HTMLSelectElement;
    settings.nimbusMode = nimbusMode.value;

    // Reminders
    const stretchInterval = document.getElementById("stretch-interval") as HTMLInputElement;
    settings.stretchReminderInterval = Number(stretchInterval.value);

    const waterInterval = document.getElementById("water-interval") as HTMLInputElement;
    settings.waterReminderInterval = Number(waterInterval.value);

    return settings;
  }
}

// Initialize
const settingsUI = new SettingsUI();
settingsUI.initialize().catch(console.error);
