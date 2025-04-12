// ipcHandlers.ts

import { ipcMain, shell, dialog } from "electron"
import { randomBytes } from "crypto"
import { IIpcHandlerDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { getAudioHelper } from "./main"

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  console.log("Initializing IPC handlers")

  // Configuration handlers
  ipcMain.handle("get-config", () => {
    return configHelper.loadConfig();
  })

  ipcMain.handle("update-config", (_event, updates) => {
    return configHelper.updateConfig(updates);
  })

  ipcMain.handle("check-api-key", () => {
    return configHelper.hasApiKey();
  })

  ipcMain.handle("validate-api-key", async (_event, apiKey) => {
    // First check the format
    if (!configHelper.isValidApiKeyFormat(apiKey)) {
      return {
        valid: false,
        error: "Invalid API key format. OpenAI API keys start with 'sk-'"
      };
    }

    // Then test the API key with OpenAI
    const result = await configHelper.testApiKey(apiKey);
    return result;
  })

  // Credits handlers
  ipcMain.handle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // Set the credits in a way that ensures atomicity
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      console.error("Error setting initial credits:", error)
      throw error
    }
  })

  ipcMain.handle("decrement-credits", async () => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      const currentCredits = await mainWindow.webContents.executeJavaScript(
        "window.__CREDITS__"
      )
      if (currentCredits > 0) {
        const newCredits = currentCredits - 1
        await mainWindow.webContents.executeJavaScript(
          `window.__CREDITS__ = ${newCredits}`
        )
        mainWindow.webContents.send("credits-updated", newCredits)
      }
    } catch (error) {
      console.error("Error decrementing credits:", error)
    }
  })

  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path)
  })

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path)
  })

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    // Check for API key before processing
    if (!configHelper.hasApiKey()) {
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
      }
      return;
    }

    await deps.processingHelper?.processScreenshots()
  })

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = []
      const currentView = deps.getView()

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue()
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      } else {
        const extraQueue = deps.getExtraScreenshotQueue()
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      }

      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot()
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        console.error("Error triggering screenshot:", error)
        return { error: "Failed to trigger screenshot" }
      }
    }
    return { error: "No main window available" }
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      const preview = await deps.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      return { error: "Failed to take screenshot" }
    }
  })

  // Auth-related handlers removed

  ipcMain.handle("open-external-url", (event, url: string) => {
    shell.openExternal(url)
  })

  // Open external URL handler
  ipcMain.handle("openLink", (event, url: string) => {
    try {
      console.log(`Opening external URL: ${url}`);
      shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error(`Error opening URL ${url}:`, error);
      return { success: false, error: `Failed to open URL: ${error}` };
    }
  })

  // Settings portal handler
  ipcMain.handle("open-settings-portal", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("show-settings-dialog");
      return { success: true };
    }
    return { success: false, error: "Main window not available" };
  })

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      console.error("Error toggling window:", error)
      return { error: "Failed to toggle window" }
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      console.error("Error resetting queues:", error)
      return { error: "Failed to reset queues" }
    }
  })

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }

      await deps.processingHelper?.processScreenshots()
      return { success: true }
    } catch (error) {
      console.error("Error processing screenshots:", error)
      return { error: "Failed to process screenshots" }
    }
  })

  // Audio recording handlers
  ipcMain.handle("start-audio-recording", async () => {
    try {
      const audioHelper = getAudioHelper();
      if (!audioHelper) {
        return { success: false, error: "Audio helper not available" };
      }

      const result = await audioHelper.startRecording();
      return result;
    } catch (error) {
      console.error("Error starting audio recording:", error);
      return { success: false, error: error.message || "Failed to start recording" };
    }
  });

  ipcMain.handle("get-recording-status", () => {
    const audioHelper = getAudioHelper();
    if (!audioHelper) {
      return { recording: false, path: null };
    }

    return audioHelper.getRecordingStatus();
  })

  ipcMain.handle("stop-audio-recording", async () => {
    try {
      const audioHelper = getAudioHelper();
      if (!audioHelper) {
        return { success: false, error: "Audio helper not available" };
      }

      const result = await audioHelper.stopRecording();

      // Notify the renderer about the recording being stopped
      const mainWindow = deps.getMainWindow();
      if (mainWindow && result.success && result.path) {
        mainWindow.webContents.send("audio-recording-stopped", { path: result.path });
      }

      return result;
    } catch (error) {
      console.error("Error stopping audio recording:", error);
      return { success: false, error: error.message || "Failed to stop recording" };
    }
  });

  ipcMain.handle("transcribe-audio", async (_event, audioPath) => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }

      const audioHelper = getAudioHelper();
      if (!audioHelper) {
        return { success: false, error: "Audio helper not available" };
      }

      // Notify the renderer that transcription is starting
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("transcription-started");
      }

      const result = await audioHelper.transcribeAudio(audioPath);

      // Notify the renderer about the transcription result
      if (mainWindow) {
        if (result.success && result.text) {
          mainWindow.webContents.send("transcription-completed", { text: result.text });
        } else {
          mainWindow.webContents.send("transcription-error", { error: result.error || "Unknown error" });
        }
      }

      return result;
    } catch (error) {
      console.error("Error transcribing audio:", error);

      // Notify the renderer about the error
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("transcription-error", { error: error.message || "Unknown error" });
      }

      return { success: false, error: error.message || "Failed to transcribe audio" };
    }
  });

  ipcMain.handle("process-audio-transcription", async (_event, transcription) => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }

      // Process the transcription
      const result = await deps.processingHelper?.processAudioTranscription(transcription);
      return result || { success: false, error: "Processing helper not available" };
    } catch (error) {
      console.error("Error processing audio transcription:", error);
      return {
        success: false,
        error: error.message || "Failed to process audio transcription"
      };
    }
  });

  ipcMain.handle("transcribe-web-audio", async (_event, base64Audio) => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }

      const audioHelper = getAudioHelper();
      if (!audioHelper) {
        return { success: false, error: "Audio helper not available" };
      }

      // Notify the renderer that transcription is starting
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("transcription-started");
      }

      console.log("Received base64 audio data, length:", base64Audio.length);

      // Convert base64 to buffer
      // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Data, 'base64');

      console.log("Converted to buffer, size:", audioBuffer.length, "bytes");

      // Save the buffer to a temporary file
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const { v4: uuidv4 } = require('uuid');

      const tempDir = path.join(os.tmpdir(), 'voice-assistant');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `web-audio-${uuidv4()}.webm`);
      fs.writeFileSync(tempFilePath, audioBuffer);

      console.log("Saved audio to temporary file:", tempFilePath);

      // Transcribe the temporary file
      const result = await audioHelper.transcribeAudio(tempFilePath);

      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFilePath);
        console.log("Temporary file deleted:", tempFilePath);
      } catch (cleanupError) {
        console.error("Error deleting temporary file:", cleanupError);
      }

      // Notify the renderer about the transcription result
      if (mainWindow) {
        if (result.success && result.text) {
          mainWindow.webContents.send("transcription-completed", { text: result.text });
        } else {
          mainWindow.webContents.send("transcription-error", { error: result.error || "Unknown error" });
        }
      }

      return result;
    } catch (error) {
      console.error("Error transcribing web audio:", error);

      // Notify the renderer about the error
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("transcription-error", { error: error.message || "Unknown error" });
      }

      return { success: false, error: error.message || "Failed to transcribe audio" };
    }
  });

  // View management handlers
  ipcMain.handle("get-view", () => {
    return deps.getView()
  })

  ipcMain.handle("set-view", (_event, view) => {
    deps.setView(view)
    return { success: true }
  })

  ipcMain.handle("set-problem-info", (_event, problemInfo) => {
    deps.setProblemInfo(problemInfo)
    return { success: true }
  })

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests()

      // Clear all queues immediately
      deps.clearQueues()

      // Reset view to queue
      deps.setView("queue")

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }

      return { success: true }
    } catch (error) {
      console.error("Error triggering reset:", error)
      return { error: "Failed to trigger reset" }
    }
  })

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      console.error("Error moving window left:", error)
      return { error: "Failed to move window left" }
    }
  })

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      console.error("Error moving window right:", error)
      return { error: "Failed to move window right" }
    }
  })

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      console.error("Error moving window up:", error)
      return { error: "Failed to move window up" }
    }
  })

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      console.error("Error moving window down:", error)
      return { error: "Failed to move window down" }
    }
  })

  // Delete last screenshot handler
  ipcMain.handle("delete-last-screenshot", async () => {
    try {
      const queue = deps.getView() === "queue"
        ? deps.getScreenshotQueue()
        : deps.getExtraScreenshotQueue()

      if (queue.length === 0) {
        return { success: false, error: "No screenshots to delete" }
      }

      // Get the last screenshot in the queue
      const lastScreenshot = queue[queue.length - 1]

      // Delete it
      const result = await deps.deleteScreenshot(lastScreenshot)

      // Notify the renderer about the change
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-deleted", { path: lastScreenshot })
      }

      return result
    } catch (error) {
      console.error("Error deleting last screenshot:", error)
      return { success: false, error: "Failed to delete last screenshot" }
    }
  })
}
