'use strict';

//const downloadUrlBase = 'https://github.com/FlexBy420/playstation_3_ird_database/raw/main/';
const downloadUrlBase = '{{github.repo_web_url}}/raw/{{github.branch_name}}/';

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
        if (val.length > 0) {
            let filtered = 0;
            for(const row of tbody.rows) {
                if (Array.from(row.cells).some(v => v.getAttribute('filter-value')?.includes(val))) {
                    row.classList.remove('d-none');
                    filtered++;
                } else {
                    row.classList.add('d-none');
                }
            }
            stats.textContent = `${filtered} of ${irdCount}`;
        } else {
            for (const row of tbody.rows) {
                row.classList.remove('d-none');
            }
            stats.textContent = `${irdCount}`;
        }
    }, 200);
}

class IrdInfo {
    title: string;
    'fw-ver': string;
    'game-ver': string;
    'app-ver': string;
    link: string;
}

async function LoadData() {
    const response = await window.fetch('all.json');
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
                titleCell.setAttribute('filter-value', irdInfo.title.toLowerCase());
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
        tableContainer.classList.remove('d-none');
    } else {
        response.statusText;
        //todo: show error box
    }
}

async function Init() {
    if (!initialized) {
        initialized = true;
        SetupTheme();
        await LoadData();
    }
}

document.addEventListener('DOMContentLoaded', Init);
window.addEventListener('load', Init);
