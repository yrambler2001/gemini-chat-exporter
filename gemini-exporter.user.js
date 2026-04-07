// ==UserScript==
// @name         Gemini Chat Exporter (PDF & Markdown)
// @namespace    https://github.com/yrambler2001/gemini-chat-exporter
// @version      2.0.0
// @description  Scrapes Gemini chat, intercepts native copy buttons for perfect Markdown, and exports a code-wrapped PDF. Bypasses virtual DOM limits.
// @author       yrambler2001
// @match        https://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gemini.google.com
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  /**
   * Configuration options.
   * Tweak these if Gemini updates their UI or if your internet/computer is slower.
   */
  const CONFIG = {
    buttonColor: '#0b57d0', // Gemini's primary blue
    buttonHoverScale: '1.05', // Size multiplier on hover
    warningColor: '#f59e0b', // Warning/Loading orange color
    scrollStep: 800, // Pixels to scroll per tick to trigger Virtual DOM rendering
    scrollDelay: 350, // MS to wait for Gemini to render new nodes after scrolling
    clipboardTimeout: 1000, // MS to wait for Gemini's native copy before timing out
  };

  // ==========================================
  // 1. UI SETUP: GLOBAL EXPORT BUTTON
  // ==========================================

  const exportBtn = document.createElement('button');
  exportBtn.textContent = '📄 Export (PDF & MD)';
  Object.assign(exportBtn.style, {
    position: 'fixed',
    top: '70px',
    right: '20px',
    zIndex: '999999',
    padding: '10px 16px',
    backgroundColor: CONFIG.buttonColor,
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontFamily: 'Google Sans, sans-serif',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    transition: 'transform 0.1s, background-color 0.2s',
  });

  exportBtn.onmouseover = () => (exportBtn.style.transform = `scale(${CONFIG.buttonHoverScale})`);
  exportBtn.onmouseout = () => (exportBtn.style.transform = 'scale(1)');

  // Wait a brief moment for Gemini's Angular framework to mount the DOM before appending
  setTimeout(() => document.body.appendChild(exportBtn), 2000);

  // ==========================================
  // 2. HELPER FUNCTIONS
  // ==========================================

  /**
   * Intercepts Gemini's native copy functionality to extract the official Markdown string.
   * Gemini uses the async `navigator.clipboard.write` with a ClipboardItem payload for AI responses,
   * and sometimes `navigator.clipboard.writeText` for user prompts. We intercept both.
   * * @param {Element} messageEl - The live DOM node of the user prompt or AI response.
   * @returns {Promise<string>} The official Markdown string, or plain text as a fallback.
   */
  async function extractNativeMarkdown(messageEl) {
    return new Promise((resolve) => {
      // Locate the copy button (handles both AI responses and User queries across different languages)
      const copyBtn =
        messageEl.querySelector('button[data-test-id="copy-button"]') ||
        messageEl.querySelector('button mat-icon[data-mat-icon-name="content_copy"]')?.closest('button');

      if (!copyBtn) {
        // Fallback: If no copy button exists (e.g., an image-only prompt), return raw text
        return resolve(messageEl.textContent.trim());
      }

      // Save original clipboard methods
      const originalWrite = navigator.clipboard.write;
      const originalWriteText = navigator.clipboard.writeText;
      let intercepted = false;

      // Utility to restore clipboard to normal operation
      const restoreClipboard = () => {
        navigator.clipboard.write = originalWrite;
        navigator.clipboard.writeText = originalWriteText;
      };

      // INTERCEPT 1: Modern ClipboardItem API (Primary method for Gemini AI responses)
      navigator.clipboard.write = async (dataArray) => {
        intercepted = true;
        restoreClipboard();

        try {
          const item = dataArray[0];
          if (item && item.types.includes('text/plain')) {
            const blob = await item.getType('text/plain');
            const text = await blob.text();
            resolve(text);
          } else {
            resolve('failed to obtain data');
          }
        } catch (err) {
          console.error('Gemini Exporter: Clipboard read error', err);
          resolve('failed to obtain data');
        }

        // Return a resolved promise to prevent Gemini's UI from throwing an error toast
        return Promise.resolve();
      };

      // INTERCEPT 2: Fallback API (Sometimes used for user prompts)
      navigator.clipboard.writeText = async (text) => {
        intercepted = true;
        restoreClipboard();
        resolve(text);
        return Promise.resolve();
      };

      // Trigger the native copy payload generation
      copyBtn.click();

      // Safety timeout: If Gemini updates their code and bypasses our hooks, don't freeze the script.
      setTimeout(() => {
        if (!intercepted) {
          restoreClipboard();
          console.warn('Gemini Exporter: Native copy interception timed out.');
          resolve(messageEl.textContent.trim()); // Fallback to raw text
        }
      }, CONFIG.clipboardTimeout);
    });
  }

  // Surgically extracts only the inner content to prevent CSS grid overlap in PDFs
  function extractCleanHTML(container, isUser) {
    const targetSelector = isUser ? '.query-text' : '.markdown';
    const targetEl = container.querySelector(targetSelector);

    if (!targetEl) return null;

    const clone = targetEl.cloneNode(true);

    const selectorsToRemove = [
      'button',
      'mat-icon',
      '[role="button"]',
      '.copy-button',
      '.action-container',
      '.snack-bar',
      'tooltip',
      '.cdk-visually-hidden',
      '[aria-hidden="true"]',
      '.code-block-decoration',
    ];
    clone.querySelectorAll(selectorsToRemove.join(', ')).forEach((el) => el.remove());

    return clone;
  }

  /**
   * Creates an invisible link to trigger a file download for the Markdown text.
   * * @param {string} text - The Markdown content.
   * @param {string} filename - The name of the file to save.
   */
  function downloadTextFile(text, filename) {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // 3. MAIN EXPORT ORCHESTRATION
  // ==========================================

  exportBtn.addEventListener('click', async () => {
    // Lock UI
    exportBtn.textContent = '⏳ Preparing...';
    exportBtn.style.backgroundColor = CONFIG.warningColor;
    exportBtn.style.pointerEvents = 'none';

    // --- 3A. EXTRACT METADATA ---
    let chatTitle = document.title.replace(' - Google Gemini', '').replace(' - Gemini', '').trim();
    if (!chatTitle || chatTitle === 'Google Gemini' || chatTitle === 'Gemini') {
      // Fallback to reading the selected conversation from the sidebar
      const sidebarTitle = document.querySelector('.conversation.selected .conversation-title');
      chatTitle = sidebarTitle ? sidebarTitle.textContent.trim() : 'Gemini Chat';
    }

    const dateObj = new Date();
    // Includes both date and time for the document header
    const dateStr = dateObj.toLocaleString();

    // Includes date and time for the filename, replacing colons with dashes so it's a valid filename
    // e.g., "2025-12-21_20-12-34"
    const fileDateStr = dateObj.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');

    // Clean the title for safe file saving
    const safeTitle = chatTitle
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
    const fileNameBase = `${safeTitle}_${fileDateStr}`;

    // --- 3B. VIRTUAL DOM HARVESTING ---
    // Gemini unmounts off-screen elements. We must scroll to the top, then step downwards
    // to force the browser to render every message so we can copy them.
    const scroller = document.querySelector('.content-container') || document.documentElement;
    scroller.scrollTop = 0;

    exportBtn.textContent = '⏳ Loading top...';
    await new Promise((r) => setTimeout(r, 1500));

    const collectedData = new Map();
    let reachedBottom = false;
    let lastScrollTop = -1;

    exportBtn.textContent = '⏳ Scraping Virtual DOM...';

    while (!reachedBottom) {
      const containers = document.querySelectorAll('.conversation-container');

      for (const container of containers) {
        const key = container.id || container.innerHTML.length.toString();

        if (!collectedData.has(key)) {
          const userQuery = container.querySelector('user-query');
          const modelResp = container.querySelector('model-response, dual-model-response, generative-ui-response');

          let userHtml = null,
            aiHtml = null;
          let userMd = '',
            aiMd = '';

          if (userQuery) {
            userHtml = extractCleanHTML(userQuery, true);
            if (userHtml) userMd = `## You\n\n${userHtml.textContent.trim()}\n\n---\n\n`;
          }

          if (modelResp) {
            aiHtml = extractCleanHTML(modelResp, false);
            const nativeMd = await extractNativeMarkdown(modelResp);
            if (nativeMd && nativeMd !== 'failed to obtain data') {
              aiMd = `## Gemini\n\n${nativeMd}\n\n---\n\n`;
            }
          }

          if (userHtml || aiHtml) {
            collectedData.set(key, {
              userHtml,
              aiHtml,
              markdown: userMd + aiMd,
            });
          }
        }
      }

      // Scroll down one chunk and wait for Angular to catch up
      scroller.scrollTop += CONFIG.scrollStep;
      await new Promise((r) => setTimeout(r, CONFIG.scrollDelay));

      // If the scroll position hasn't changed, we've hit the bottom
      if (scroller.scrollTop === lastScrollTop) {
        reachedBottom = true;
      }
      lastScrollTop = scroller.scrollTop;
    }

    exportBtn.textContent = '📄 Generating Files...';

    // --- 3C. COMPILE & DOWNLOAD MARKDOWN ---
    let markdownText = `# ${chatTitle}\n**Exported:** ${dateStr}\n\n---\n\n`;

    collectedData.forEach((data) => {
      markdownText += data.markdown;
    });

    // Clean up excessive newlines, then trigger download
    markdownText = markdownText.replace(/\n{3,}/g, '\n\n');
    downloadTextFile(markdownText, `${fileNameBase}.md`);

    // --- 3D. RECONSTRUCT DOM FOR PDF PRINTING ---
    const printContainer = document.createElement('div');
    printContainer.id = 'gemini-print-container';
    printContainer.style.margin = '0 auto';
    printContainer.style.maxWidth = '830px';
    printContainer.style.padding = '20px';
    printContainer.style.paddingTop = '40px';

    // Create PDF Header
    const pdfHeader = document.createElement('div');
    pdfHeader.style.marginBottom = '30px';
    pdfHeader.style.fontFamily = "'Google Sans', sans-serif";

    const pdfTitle = document.createElement('h1');
    pdfTitle.textContent = chatTitle;
    pdfTitle.style.marginBottom = '5px';

    const pdfDate = document.createElement('p');
    pdfDate.textContent = `Exported: ${dateStr}`;
    pdfDate.style.color = '#666';
    pdfDate.style.marginTop = '0';

    pdfHeader.appendChild(pdfTitle);
    pdfHeader.appendChild(pdfDate);
    printContainer.appendChild(pdfHeader);

    // Append cleanly extracted content nodes with explicit labels to avoid CSS Grid overlaps
    collectedData.forEach((data) => {
      if (data.userHtml) {
        const userWrapper = document.createElement('div');
        userWrapper.className = 'pdf-message-wrapper user-message';
        const label = document.createElement('strong');
        label.textContent = 'You:';
        userWrapper.appendChild(label);
        userWrapper.appendChild(data.userHtml);
        printContainer.appendChild(userWrapper);
      }

      if (data.aiHtml) {
        const aiWrapper = document.createElement('div');
        aiWrapper.className = 'pdf-message-wrapper ai-message';
        const label = document.createElement('strong');
        label.textContent = 'Gemini:';
        aiWrapper.appendChild(label);
        aiWrapper.appendChild(data.aiHtml);
        printContainer.appendChild(aiWrapper);
      }
    });

    // Hide original Gemini UI (better than innerHTML='' as it preserves <style> tags)
    Array.from(document.body.children).forEach((child) => {
      if (child !== exportBtn) child.style.display = 'none';
    });

    document.body.appendChild(printContainer);
    document.body.style.background = '#ffffff';
    document.body.style.overflow = 'visible';

    // Inject specific Print CSS
    const printStyle = document.createElement('style');
    // We use textContent instead of innerHTML to safely bypass Google's Trusted Types policy
    printStyle.textContent = `
            /* Defeat Gemini's lazy rendering hiding rules */
            * { content-visibility: visible !important; }
            
            body { background: #ffffff !important; color: #1f1f1f !important; }

            /* Clean block formatting to prevent overlaps */
            .pdf-message-wrapper {
                display: block !important;
                margin-bottom: 30px !important;
                padding-bottom: 20px !important;
                border-bottom: 1px solid #e5e7eb;
                page-break-inside: auto !important;
                font-family: 'Google Sans', sans-serif;
            }
            
            .pdf-message-wrapper strong {
                display: block;
                margin-bottom: 10px;
                font-size: 1.1rem;
            }
            
            .user-message strong { color: #0b57d0; }
            .ai-message strong { color: #1f1f1f; }
            
            /* Allow code blocks to wrap text, and allow the blocks themselves to split across pages */
            pre, code, .code-container {
                white-space: pre-wrap !important;
                word-break: break-word !important;
                overflow-wrap: break-word !important;
                overflow-x: hidden !important; 
                max-width: 100% !important;
                page-break-inside: auto !important; 
            }
            
            pre {
                background-color: #f8f9fa !important;
                padding: 16px !important;
                border-radius: 8px !important;
                border: 1px solid #dadce0 !important;
                margin: 16px 0 !important;
            }
            
            @media print {
                @page { margin: 1cm; }
                body { 
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact; 
                }
                button { display: none !important; }
            }
        `;
    document.head.appendChild(printStyle);

    // Trick Chrome into using our safe title as the default PDF filename
    document.title = fileNameBase;

    // Trigger the print dialog, then refresh to restore the normal Gemini UI
    setTimeout(() => {
      window.print();
      setTimeout(() => window.location.reload(), 500);
    }, 1000);
  });
})();
