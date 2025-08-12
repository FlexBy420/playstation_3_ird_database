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
function CleanTitle(title) {
    let charr = title.split("").map(c => c.charCodeAt(0));
    const arrLen = charr.length;
    for (let i = 0; i < arrLen; i++) {
        const ch = charr[i];
        if (ch > 0xff00 && ch <= 0xff5e) {
            charr[i] = ch - 0xfee0;
        }
        else if (ch > 0x30a0 && ch <= 0x30f6) {
            charr[i] = ch - 0x0060;
        }
    }
    return charr.map(c => String.fromCharCode(c)).join("")
        .toLowerCase()
        .replaceAll('[', '')
        .replaceAll(']', '')
        .replaceAll('(tm)', '')
        .replaceAll(' ™', '')
        .replaceAll('™', '')
        .replaceAll('(r)', '')
        .replaceAll(' ®', '')
        .replaceAll('®', '')
        .replaceAll('\u3000', ' ')
        .replaceAll('\r\n', ' ')
        .replaceAll('\r', ' ')
        .replaceAll('\n', ' ')
        .replaceAll('    ', ' ')
        .replaceAll('   ', ' ')
        .replaceAll('  ', ' ')
        .replaceAll('\u00B7', '・')
        .replaceAll('\uFF65', '・')
        .replaceAll('\u2160', 'I')
        .replaceAll('\u2161', 'II')
        .replaceAll('\u2162', 'III')
        .replaceAll('\u2163', 'IV')
        .replaceAll('\u2164', 'V')
        .replaceAll('\u2165', 'VI')
        .replaceAll('core4', 'core4')
        .replaceAll('baлл•и', 'валли')
        .replaceAll('disgaea3', 'disgaea 3')
        .replaceAll('disgaea4', 'disgaea 4')
        .replaceAll('l@ve', 'love')
        .replaceAll('prototype2', 'prototype 2')
        .replaceAll('singstar vol.', 'singstar vol ')
        .replaceAll('skate.', 'skate 1');
}
let filterTimeout = null;
function Filter() {
    if (filterTimeout !== null) {
        clearTimeout(filterTimeout);
    }
    filterTimeout = setTimeout(() => {
        const filter = document.getElementById('filter');
        const val = filter.value?.toLowerCase().trim();
        const normalizedVal = val.replace(/[-\s]/g, '');
        const table = document.getElementById('table');
        const tbody = table.tBodies[0];
        const stats = document.getElementById('ird_count');
        const clearButton = document.getElementById('clear_button');
        if (val.length > 0) {
            clearButton.classList.remove('d-none');
            let filtered = 0;
            for (const row of tbody.rows) {
                const codeCellValue = row.cells[0].getAttribute('filter-value').toLowerCase().replace(/[-\s]/g, '');
                const titleCellValue = row.cells[1].getAttribute('filter-value').toLowerCase();
                if (codeCellValue.includes(normalizedVal) || titleCellValue.includes(val)) {
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
                titleCell.setAttribute('filter-value', CleanTitle(irdInfo.title));
                row.insertCell().textContent = irdInfo['app-ver'];
                row.insertCell().textContent = irdInfo['game-ver'];
                row.insertCell().textContent = irdInfo['fw-ver'];
                row.insertCell().textContent = irdInfo['file-count'];
                const sizeCell = row.insertCell();
                const bytes = parseInt(irdInfo['disc-size'], 10);
                sizeCell.textContent = formatSize(bytes);
                sizeCell.title = `${bytes.toLocaleString("en-US")} bytes (${formatSize(bytes)})`;
                sizeCell.setAttribute("data-bytes", bytes);
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

window.onscroll = function() {scrollFunction()};
function scrollFunction() {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    document.getElementById("scrollToTopBtn").style.display = "block";
  } else {
    document.getElementById("scrollToTopBtn").style.display = "none";
  }
}
function scrollToTop() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}

// sorting functions
const SORT_ASC = 'asc';
const SORT_DESC = 'desc';

let sortDirections = {
    'Product Code': null,
    'Title': null,
    'App Version': null,
    'Game Version': null,
    'Firmware Version': null,
    'Files': null,
    'Size': null
};

function sortTable(columnIndex, order) {
    const table = document.getElementById('table');
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);

    rows.sort((a, b) => {
        let aValue = a.cells[columnIndex].getAttribute("data-bytes") || a.cells[columnIndex].textContent.trim();
        let bValue = b.cells[columnIndex].getAttribute("data-bytes") || b.cells[columnIndex].textContent.trim();

        if (!isNaN(aValue) && !isNaN(bValue)) {
            aValue = parseFloat(aValue);
            bValue = parseFloat(bValue);
        }

        if (order === SORT_ASC) {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });

    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}

function handleSort(event) {
    const columnHeader = event.target.textContent.trim();
    const columnIndex = Array.from(event.target.parentNode.children).indexOf(event.target);
    let sortOrder;

    if (sortDirections[columnHeader] === SORT_ASC) {
        sortOrder = SORT_DESC;
    } else {
        sortOrder = SORT_ASC;
    }

    sortDirections[columnHeader] = sortOrder;
    event.target.parentNode.querySelectorAll('th').forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
    event.target.classList.add(`sorted-${sortOrder}`);
    sortTable(columnIndex, sortOrder);
}
document.querySelectorAll('#table th').forEach(th => th.addEventListener('click', handleSort));

function formatSize(bytes) {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return value.toFixed(2) + " " + sizes[i];
}