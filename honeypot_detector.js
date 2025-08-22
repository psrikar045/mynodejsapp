/**
 * HoneypotDetector
 * Detects likely honeypot/trap elements and returns a list of CSS selectors to avoid/remove.
 * Heuristics target hidden/offscreen/aria-hidden elements and suspicious names.
 *
 * Persistent learning: stores discovered traps per hostname in a JSON file and reuses them in future runs.
 */
const fs = require('fs').promises;
const path = require('path');

class HoneypotDetector {
    constructor(options = {}) {
        this.storePath = options.storePath || path.join(process.cwd(), 'honeypots.json');
        this.maxPerHost = options.maxPerHost || 500;
    }

    async loadStore() {
        try {
            const raw = await fs.readFile(this.storePath, 'utf-8');
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    async saveStore(store) {
        try {
            await fs.writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
        } catch {}
    }

    async getKnownTrapsFor(urlStr) {
        const host = this._host(urlStr);
        const store = await this.loadStore();
        return store[host] || [];
    }

    async addTraps(urlStr, traps) {
        if (!traps || traps.length === 0) return;
        const host = this._host(urlStr);
        const store = await this.loadStore();
        const existing = new Set(store[host] || []);
        for (const t of traps) existing.add(t);
        const merged = Array.from(existing).slice(0, this.maxPerHost);
        store[host] = merged;
        await this.saveStore(store);
        return merged;
    }

    /**
     * Detect traps on the current page using heuristics
     * @param {import('puppeteer').Page} page
     * @returns {Promise<string[]>}
     */
    async detect(page) {
        try {
            const traps = await page.evaluate(() => {
                const results = [];

                const isHidden = (el) => {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    const offscreen = (rect.width === 0 && rect.height === 0) || rect.left < -2000 || rect.top < -2000;
                    return (
                        style.display === 'none' ||
                        style.visibility === 'hidden' ||
                        parseFloat(style.opacity || '1') === 0 ||
                        el.hasAttribute('hidden') ||
                        el.getAttribute('aria-hidden') === 'true' ||
                        offscreen
                    );
                };

                const looksSuspiciousName = (el) => {
                    const attrs = ['name', 'id', 'class'];
                    const s = attrs.map(a => (el.getAttribute(a) || '').toLowerCase()).join(' ');
                    return /(honeypot|trap|bot|do\-not\-fill|human\-check|leave\-empty)/i.test(s);
                };

                const toSelector = (el) => {
                    if (el.id) return `#${CSS.escape(el.id)}`;
                    const name = el.getAttribute('name');
                    if (name) return `[name="${name}"]`;
                    const classes = (el.className || '').toString().trim().split(/\s+/).filter(Boolean);
                    if (classes.length) return `.${classes.map(c => CSS.escape(c)).join('.')}`;
                    // Fallback: tag with nth-child
                    const tag = el.tagName.toLowerCase();
                    const parent = el.parentElement;
                    if (!parent) return tag;
                    const index = Array.from(parent.children).indexOf(el) + 1;
                    return `${tag}:nth-child(${index})`;
                };

                const candidates = Array.from(document.querySelectorAll('input, textarea, select, a, button, div, span, form'));
                for (const el of candidates) {
                    try {
                        if (isHidden(el) || looksSuspiciousName(el)) {
                            results.push(toSelector(el));
                        }
                    } catch {}
                }

                return Array.from(new Set(results)).slice(0, 200);
            });
            return traps || [];
        } catch {
            return [];
        }
    }

    _host(urlStr) {
        try { return new URL(urlStr).host; } catch { return 'unknown'; }
    }
}

module.exports = { HoneypotDetector };