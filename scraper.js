const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function runScraper(meetingUrl) {
    console.log("Launching headless browser (true headless mode)...");
    const browser = await puppeteer.launch({
        headless: 'new', // True headless mode
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--disable-notifications',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
    });

    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set a normal viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Block the "Open Teams App" prompt by intercepting the deep link
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().startsWith('msteams:')) {
            request.abort();
        } else {
            request.continue();
        }
    });

    console.log(`Navigating to Teams Meeting: ${meetingUrl}`);
    await page.goto(meetingUrl, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'step1_loaded.png' });

    try {
        console.log("Waiting for 'Continue on this browser' button...");
        await page.waitForSelector('button[data-tid="joinOnWeb"]', { timeout: 15000 }).catch(() => {});
        
        const joinWebBtn = await page.$('button[data-tid="joinOnWeb"]');
        if (joinWebBtn) {
            console.log("Clicking 'Continue on this browser'");
            await page.evaluate(() => {
                const btn = document.querySelector('button[data-tid="joinOnWeb"]');
                if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 5000)); // Wait for transition
        }
        await page.screenshot({ path: 'step2_after_continue.png' });

        console.log("Waiting for Pre-join screen (this can take up to a minute on Teams Web)...");
        try {
            await page.waitForSelector('input[type="text"]', { timeout: 60000 });
            console.log("Entering bot name...");
            await page.type('input[type="text"]', 'Standup Bot');

            const micToggle = await page.$('toggle-button[data-tid="toggle-mute"]');
            if (micToggle) await micToggle.click();

            console.log("Clicking 'Join now'...");
            await new Promise(r => setTimeout(r, 1000)); // Wait for Join button to enable
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const joinBtn = btns.find(b => b.innerText.includes('Join now') || (b.getAttribute('data-tid') && b.getAttribute('data-tid').includes('join')));
                if (joinBtn) joinBtn.click();
            });
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.log("⚠️ Could not auto-fill the name. Capturing screenshot for debugging...");
            await page.screenshot({ path: 'step3_error_prejoin.png' });
            throw new Error("Failed to join automatically. See step3_error_prejoin.png");
        }

        console.log("-----------------------------------------------------");
        console.log("⏳ Waiting to enter the meeting (admit from lobby if needed).");
        console.log("-----------------------------------------------------");
        await page.screenshot({ path: 'step4_waiting_in_lobby.png' });

        // Wait up to 3 mins for user to be admitted
        await page.waitForFunction(() => {
            return document.querySelector('#roster-button') || document.querySelector('#hangup-button') || document.querySelector('button[aria-label="Leave"]');
        }, { timeout: 180000 });
        console.log("✅ Admitted to the meeting!");
        await page.screenshot({ path: 'step5_in_meeting.png' });

        // Wait a few seconds for UI to settle
        await new Promise(r => setTimeout(r, 5000));

        console.log("Attempting to turn on Live Captions...");
        try {
            // Click the "More" (...) button
            const moreBtn = await page.$('button[id="calling-roster-more-button"]') || await page.$('button[aria-label="More actions"]');
            if (moreBtn) {
                await moreBtn.click();
                await new Promise(r => setTimeout(r, 2000));
                
                // Click "Turn on live captions"
                // Using XPath because class names change frequently
                const captionsSpan = await page.$x("//span[contains(text(), 'Turn on live captions')]");
                if (captionsSpan.length > 0) {
                    await captionsSpan[0].click();
                    console.log("Live captions enabled!");
                } else {
                    console.log("Could not find 'Turn on live captions' in the menu. They might already be on, or the UI changed.");
                }
            }
        } catch (e) {
            console.log("Error trying to enable captions automatically. You may need to enable them manually in the bot's browser window.");
        }

        console.log("Started recording captions... Press Ctrl+C in this terminal when the meeting is over to process the transcript.");

        // Inject script to observe DOM for new captions
        const getTranscriptPromise = new Promise((resolve) => {
            // We expose a function to the browser to send data back to Node
            page.exposeFunction('sendTranscriptToNode', (transcriptData) => {
                resolve(transcriptData);
            });

            page.evaluate(() => {
                let fullTranscript = [];
                let currentSpeaker = "";

                // Find the caption container
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { // Element node
                                // Teams captions usually have a speaker name and text
                                // This is a generic heuristic scraper for live captions
                                const speakerElement = node.querySelector('.ui-chat__message__author') || node.querySelector('[data-tid="closed-caption-speaker"]');
                                const textElement = node.querySelector('.ui-chat__message__content') || node.querySelector('[data-tid="closed-caption-text"]');
                                
                                if (textElement) {
                                    if (speakerElement && speakerElement.innerText) {
                                        currentSpeaker = speakerElement.innerText;
                                    }
                                    const text = textElement.innerText;
                                    
                                    // Append to full transcript
                                    fullTranscript.push(`${currentSpeaker || 'Unknown'}: ${text}`);
                                }
                            }
                        });
                    });
                });

                // Observe the document body for caption elements being added
                observer.observe(document.body, { childList: true, subtree: true });
                
                // Also capture window close or user triggering save
                window.addEventListener('beforeunload', () => {
                    window.sendTranscriptToNode(fullTranscript.join('\n'));
                });

                // Provide a manual way to stop from console
                window.finishMeeting = () => {
                    window.sendTranscriptToNode(fullTranscript.join('\n'));
                };
            });
        });

        // The script waits until finishMeeting() is called in the browser, or the browser closes.
        const rawTranscript = await getTranscriptPromise;
        console.log("Meeting ended. Transcript collected.");
        
        await browser.close();
        return rawTranscript;

    } catch (err) {
        console.error("Error during scraping:", err);
        await browser.close();
        return "";
    }
}

module.exports = {
    runScraper
};
