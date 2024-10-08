'use strict';

//const downloadUrlBase = 'https://github.com/FlexBy420/playstation_3_ird_database/raw/main/';
const branch = '{{github.branch_name}}';
const commit = '{{github.sha}}';
const downloadUrlBase = `{{github.repo_web_url}}/raw/${branch}/`;

// TypeScript type definition for compiler
declare namespace bootstrap {
    class Tooltip {
        constructor(el: Element);
    }
}

let initialized = false;
let irdCount = 0;

function Delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function SetupTheme() {
    const setTheme = () => document.documentElement.setAttribute('data-bs-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setTheme);
}

function EnableTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

function CleanTitle(title: string): string {
    let charr = title.split("").map(c => c.charCodeAt(0));
    const arrLen = charr.length;
    for (let i=0; i<arrLen; i++) {
        const ch = charr[i];
        if (ch > 0xff00 && ch <= 0xff5e) {
            // replace full-width characters from ! to ~
            charr[i] = ch - 0xfee0; // ch - 0xff00 + 0x0020
        } else if (ch > 0x30a0 && ch <= 0x30f6) {
            // replace katakana with hiragana (helps with filter during input)
            charr[i] = ch - 0x0060; // ch - 0x30a0 + 0x3040
        }
    }
    return charr.map(c => String.fromCharCode(c)).join("")
        .toLowerCase()
        // [prototype2]
        .replaceAll('[', '')
        .replaceAll(']', '')
        // marks
        .replaceAll('(tm)', '')
        .replaceAll(' ™', '')
        .replaceAll('™', '')
        .replaceAll('(r)', '')
        .replaceAll(' ®', '')
        .replaceAll('®', '')
        // whitespaces and punctuation
        .replaceAll('\u3000', ' ')
        .replaceAll('\r\n', ' ')
        .replaceAll('\r', ' ')
        .replaceAll('\n', ' ')
        .replaceAll('    ', ' ')
        .replaceAll('   ', ' ')
        .replaceAll('  ', ' ')
        .replaceAll('\u00B7', '・')
        .replaceAll('\uFF65', '・')
        // roman numbers
        .replaceAll('\u2160', 'I')
        .replaceAll('\u2161', 'II')
        .replaceAll('\u2162', 'III')
        .replaceAll('\u2163', 'IV')
        .replaceAll('\u2164', 'V')
        .replaceAll('\u2165', 'VI')
        // titles
        .replaceAll('core4', 'core4')
        .replaceAll('baлл•и', 'валли')
        .replaceAll('disgaea3', 'disgaea 3')
        .replaceAll('disgaea4', 'disgaea 4')
        .replaceAll('l@ve', 'love')
        .replaceAll('prototype2', 'prototype 2')
        .replaceAll('singstar vol.', 'singstar vol ')
        .replaceAll('skate.', 'skate 1');
}

let filterTimeout: number|null = null;
function Filter() {
    if (filterTimeout !== null) {
        clearTimeout(filterTimeout);
    }
    filterTimeout = setTimeout(() => {
        const filter = document.getElementById('filter') as HTMLInputElement;
        const val = filter.value?.toLowerCase();
        const table = document.getElementById('table') as HTMLTableElement;
        const tbody = table.tBodies[0];
        const stats = document.getElementById('ird_count') as HTMLSpanElement;
        const clearButton = document.getElementById('clear_button') as HTMLElement;
        if (val.length > 0) {
            clearButton.classList.remove('d-none');
            let filtered = 0;
            for(const row of tbody.rows) {
                if (Array.from(row.cells).some(v => v.getAttribute('filter-value')?.includes(val) || v.textContent?.includes(val))) {
                    row.classList.remove('d-none');
                    filtered++;
                } else {
                    row.classList.add('d-none');
                }
            }
            stats.textContent = `${filtered} of ${irdCount}`;
        } else {
            clearButton.classList.add('d-none');
            for (const row of tbody.rows) {
                row.classList.remove('d-none');
            }
            stats.textContent = `${irdCount}`;
        }
    }, 200);
}

function ClearFilter() {
    const clearFilterBtn = document.getElementById('clear_button') as HTMLButtonElement;
    clearFilterBtn.classList.add('d-none');
    const filter = document.getElementById('filter') as HTMLInputElement;
    filter.value = '';
    filter.onchange?.call(filter);
}
function OnKb(event: KeyboardEvent) {
    if (event.code === 'Escape') {
        ClearFilter();
    }
}

class IrdInfo {
    title: string;
    'fw-ver': string;
    'game-ver': string;
    'app-ver': string;
    link: string;
}

async function LoadData() {
    const response = await window.fetch(`all.json?v=${commit}`);
    if (response.ok) {
        const data = await response.json();
        const progressBar = document.getElementById('loading_progress') as HTMLDivElement;
        const progressStatus = document.getElementById('loading_status') as HTMLDivElement;
        const tableContainer = document.getElementById('table_container') as HTMLDivElement;
        const table = document.getElementById('table') as HTMLTableElement;
        const tbody = table.tBodies[0];
        const codeCount = Object.keys(data).length;
        let i=0;
        for (const code in data) {
            const irdInfoList = data[code] as IrdInfo[];
            for (const irdInfo of irdInfoList) {
                const linkSegments = irdInfo.link.split('/');
                const filename = linkSegments[linkSegments.length-1];
                // code, title, app, game, fw, link
                const row = tbody.insertRow();
                const codeCell = row.insertCell();
                //codeCell.classList.add('font-monospace');
                codeCell.textContent = code;
                codeCell.setAttribute('filter-value', code.toLowerCase());
                const titleCell = row.insertCell();
                titleCell.textContent = irdInfo.title;
                titleCell.setAttribute('filter-value', CleanTitle(irdInfo.title));
                row.insertCell().textContent = irdInfo['app-ver'];
                row.insertCell().textContent = irdInfo['game-ver'];
                row.insertCell().textContent = irdInfo['fw-ver'];
                row.insertCell().innerHTML = `<a href="${downloadUrlBase}${irdInfo.link}" class="icon-link" download filename="${filename}" rel="external noopener" referrerpolicy="origin"><i class="bi bi-download"></i><span class="d-none d-xl-block"> ${filename}</span></a>`;
                irdCount++;
            }
            i++;
            if (i % 100 === 0 || i === codeCount) {
                const value = (i * 100 / codeCount).toFixed(1);
                progressBar.ariaValueNow = value;
                progressStatus.textContent = `Processing… ${value}%`;
                progressStatus.style.width = `${value}%`;
                await Delay(1);
            }
        }
        progressBar.classList.add('d-none');
        const stat = document.getElementById('ird_count') as HTMLSpanElement;
        stat.textContent = `${irdCount}`;
        const filter = document.getElementById('filter') as HTMLInputElement;
        filter.oninput = Filter;
        filter.onchange = Filter;
        filter.onkeydown = OnKb;
        const clearFilter = document.getElementById('clear_button') as HTMLButtonElement;
        clearFilter.onclick = ClearFilter;
        tableContainer.classList.remove('d-none');
        filter.focus();
    } else {
        response.statusText;
        //todo: show error box
    }
}

async function Init() {
    if (!initialized) {
        initialized = true;
        const ver = document.getElementById('version') as HTMLSpanElement;
        ver.textContent = `${branch} // ${commit}`;
        SetupTheme();
        EnableTooltips();
        await LoadData();
    }
}

document.addEventListener('DOMContentLoaded', Init);
window.addEventListener('load', Init);
