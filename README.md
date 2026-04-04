# Gemini Chat Exporter (PDF & Native Markdown) 📄✨

A powerful Tampermonkey/Greasemonkey userscript that allows you to seamlessly export your Google Gemini conversations into beautifully formatted **PDFs** and clean **Markdown (.md)** files.

![Preview of the Export Button](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🌟 The Problem

Exporting long chats from modern AI web apps is notoriously difficult:

1. **Virtual DOM:** Gemini deletes off-screen messages to save memory. Standard printing only captures what is currently visible on your screen.
2. **PDF Code Cutoff:** Long code blocks don't wrap when printed to PDF, causing the code to run off the edge of the page.
3. **Dirty Markdown:** Third-party parsers often copy UI clutter (like "Copy", "Edit", or hidden screen-reader text).

## 🛠️ The Solution

This script solves all of these issues natively:

- **Virtual DOM Harvester:** The script automatically takes control, jumps to the top of the chat, and systematically scrolls downwards. It takes a perfect snapshot of every single message in the thread as it renders into view.
- **Native Markdown Interception:** Instead of guessing the formatting, the script programmatically clicks Gemini's _actual_ hidden copy buttons and intercepts the `navigator.clipboard.write` API to steal the exact, Google-approved Markdown string for every message.
- **Smart PDF Formatting:** It strips out all UI buttons, injects a custom header with the Chat Title and Date, and forces CSS rules (`white-space: pre-wrap !important`) so that your code blocks wrap perfectly to the next line in the PDF.
- **Trusted Types Compliant:** Bypasses Google's strict Trusted Types Content Security Policy (CSP) securely.

## 🚀 Installation

1. Install a userscript manager extension for your browser:
   - **Chrome/Edge:** [Tampermonkey](https://www.tampermonkey.net/)
   - **Firefox:** [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) or Tampermonkey
2. Click the link below to install the script directly:
   - 👉 [**Install from GitHub**](gemini-exporter.user.js) 
3. Alternatively, create a new script in your manager and paste the contents of `gemini-exporter.user.js` into it.

## 📖 Usage

1. Open a chat on [Google Gemini](https://gemini.google.com).
2. You will see a blue **"📄 Export (PDF & Native MD)"** button in the top right corner.
3. Click the button. **Do not touch your mouse or scroll.** 4. The script will jump to the top of the chat and systematically scroll downwards to harvest every message.
4. A perfectly formatted `.md` file will automatically download to your computer.
5. One second later, your browser's native Print dialog will open. Make sure "Save as PDF" is selected. Your PDF will contain the full thread, perfectly styled, with wrapping code blocks.
6. The page will automatically refresh to restore your standard session once the dialog closes.

## ⚙️ Configuration

If you have a slower computer or internet connection, the virtual DOM might take longer to load while scrolling. You can edit the top of the script to increase the `scrollDelay`:

```javascript
const CONFIG = {
  scrollStep: 800, // Pixels to scroll down per tick
  scrollDelay: 350, // Increase this (e.g., to 600) if messages are being skipped
  clipboardTimeout: 1000,
};
```

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. Because Google frequently updates Gemini's CSS classes, community reports on broken selectors are highly appreciated!

## 📝 License

[MIT](https://choosealicense.com/licenses/mit/)
