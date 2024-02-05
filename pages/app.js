'use strict';
const branch = '{{github.branch_name}}';
const commit = '{{github.sha}}';
const downloadUrlBase = `{{github.repo_web_url}}/raw/${branch}/`;
let initialized = false;
let irdCount = 0;
function Delay(ms) {
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
let filterTimeout = null;
function Filter() {
    if (filterTimeout !== null) {
        clearTimeout(filterTimeout);
    }
    filterTimeout = setTimeout(() => {
        const filter = document.getElementById('filter');
        const val = filter.value?.toLowerCase();
        const table = document.getElementById('table');
        const tbody = table.tBodies[0];
        const stats = document.getElementById('ird_count');
        const clearButton = document.getElementById('clear_button');
        if (val.length > 0) {
            clearButton.classList.remove('d-none');
            let filtered = 0;
            for (const row of tbody.rows) {
                if (Array.from(row.cells).some(v => v.getAttribute('filter-value')?.includes(val))) {
                    row.classList.remove('d-none');
                    filtered++;
                }
                else {
                    row.classList.add('d-none');
                }
            }
            stats.textContent = `${filtered} of ${irdCount}`;
        }
        else {
            clearButton.classList.add('d-none');
            for (const row of tbody.rows) {
                row.classList.remove('d-none');
            }
            stats.textContent = `${irdCount}`;
        }
    }, 200);
}
function ClearFilter() {
    const clearFilterBtn = document.getElementById('clear_button');
    clearFilterBtn.classList.add('d-none');
    const filter = document.getElementById('filter');
    filter.value = '';
    filter.onchange?.call(filter);
}
function OnKb(event) {
    if (event.code === 'Escape') {
        ClearFilter();
    }
}
class IrdInfo {
    title;
    'fw-ver';
    'game-ver';
    'app-ver';
    link;
}
async function LoadData() {
    const response = await window.fetch(`all.json?v=${commit}`);
    if (response.ok) {
        const data = await response.json();
        const progressBar = document.getElementById('loading_progress');
        const progressStatus = document.getElementById('loading_status');
        const tableContainer = document.getElementById('table_container');
        const table = document.getElementById('table');
        const tbody = table.tBodies[0];
        const codeCount = Object.keys(data).length;
        let i = 0;
        for (const code in data) {
            const irdInfoList = data[code];
            for (const irdInfo of irdInfoList) {
                const linkSegments = irdInfo.link.split('/');
                const filename = linkSegments[linkSegments.length - 1];
                const row = tbody.insertRow();
                const codeCell = row.insertCell();
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
        const stat = document.getElementById('ird_count');
        stat.textContent = `${irdCount}`;
        const filter = document.getElementById('filter');
        filter.oninput = Filter;
        filter.onchange = Filter;
        filter.onkeydown = OnKb;
        const clearFilter = document.getElementById('clear_button');
        clearFilter.onclick = ClearFilter;
        tableContainer.classList.remove('d-none');
        filter.focus();
    }
    else {
        response.statusText;
    }
}
async function Init() {
    if (!initialized) {
        initialized = true;
        const ver = document.getElementById('version');
        ver.textContent = `${branch} // ${commit}`;
        SetupTheme();
        EnableTooltips();
        await LoadData();
    }
}
document.addEventListener('DOMContentLoaded', Init);
window.addEventListener('load', Init);
//# sourceMappingURL=app.js.map