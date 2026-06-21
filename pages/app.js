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
const SOURCES = [
    { id: 'redump', label: 'Redump', linkPrefix: 'Redump/' },
    { id: 'aldostools', label: 'aldostools', linkPrefix: 'ps3.aldostools.org/' },
    { id: 'ps3ird', label: "Zar's (ps3ird.free.fr)", linkPrefix: 'ps3ird.free.fr/' },
];
function getSourceFromLink(link) {
    for (const src of SOURCES) {
        if (link.startsWith(src.linkPrefix)) {
            return src.id;
        }
    }
    return 'unknown';
}
const REGIONS = [
    { id: 'EU', label: 'Europe' },
    { id: 'US', label: 'America' },
    { id: 'AS', label: 'Asia' },
    { id: 'JP', label: 'Japan' },
    { id: 'KR', label: 'Korea' },
    { id: 'IN', label: 'International' },
    { id: 'unknown', label: 'Other / unknown' },
];
function getRegionFromId(id) {
    switch ((id[2] || '').toUpperCase()) {
        case 'E': return 'EU';
        case 'U': return 'US';
        case 'A': return 'AS';
        case 'J': return 'JP';
        case 'K': return 'KR';
        case 'I':
        case 'T': return 'IN';
        default: return 'unknown';
    }
}
const activeSources = new Set();
const activeRegions = new Set();
function BuildFilterDropdown(containerId, badgeId, items, activeSet, onChange) {
    const container = document.getElementById(containerId);
    const badge = document.getElementById(badgeId);
    container.innerHTML = items.map(item => `
        <li>
            <label class="dropdown-item mb-0">
                <input type="checkbox" class="form-check-input me-2" value="${item.id}">${item.label}
            </label>
        </li>`).join('');
    const updateBadge = () => {
        badge.textContent = `${activeSet.size}`;
        badge.classList.toggle('d-none', activeSet.size === 0);
    };
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const value = cb.value;
            if (cb.checked) {
                activeSet.add(value);
            }
            else {
                activeSet.delete(value);
            }
            updateBadge();
            onChange();
        });
    });
    updateBadge();
}
let filterTimeout = null;
function Filter() {
    if (filterTimeout !== null) {
        clearTimeout(filterTimeout);
    }
    filterTimeout = setTimeout(() => {
        const filter = document.getElementById('filter');
        const val = filter.value?.toLowerCase().trim() ?? '';
        const normalizedVal = val.replace(/[-\s]/g, '');
        const table = document.getElementById('table');
        const tbody = table.tBodies[0];
        const stats = document.getElementById('ird_count');
        const clearButton = document.getElementById('clear_button');
        const hasTextFilter = val.length > 0;
        const hasSourceFilter = activeSources.size > 0;
        const hasRegionFilter = activeRegions.size > 0;
        clearButton.classList.toggle('d-none', !hasTextFilter);
        let filtered = 0;
        for (const row of Array.from(tbody.rows)) {
            let visible = true;
            if (hasTextFilter) {
                const codeCellValue = (row.cells[0].getAttribute('filter-value') || '').replace(/[-\s]/g, '');
                const titleCellValue = row.cells[1].getAttribute('filter-value') || '';
                visible = codeCellValue.includes(normalizedVal) || titleCellValue.includes(val);
            }
            if (visible && hasSourceFilter) {
                visible = activeSources.has((row.getAttribute('data-source') || ''));
            }
            if (visible && hasRegionFilter) {
                visible = activeRegions.has((row.getAttribute('data-region') || ''));
            }
            row.classList.toggle('d-none', !visible);
            if (visible) {
                filtered++;
            }
        }
        if (hasTextFilter || hasSourceFilter || hasRegionFilter) {
            stats.textContent = `${filtered} of ${irdCount}`;
        }
        else {
            stats.textContent = `${irdCount}`;
        }
    }, 200);
}
function ClearFilter() {
    const clearFilterBtn = document.getElementById('clear_button');
    clearFilterBtn.classList.add('d-none');
    const filter = document.getElementById('filter');
    filter.value = '';
    filter.onchange?.call(filter, new Event('change'));
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
    'file-count';
    'disc-size';
    link;
}
function formatSize(bytes) {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0)
        return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return value.toFixed(2) + " " + sizes[i];
}
function escapeHtml(str) {
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
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
        const sourceCounts = new Map();
        const regionCounts = new Map();
        let i = 0;
        let html = '';
        const CHUNK_SIZE = 500;
        for (const code in data) {
            const region = getRegionFromId(code);
            const irdInfoList = data[code];
            for (const irdInfo of irdInfoList) {
                const linkSegments = irdInfo.link.split('/');
                const filename = linkSegments[linkSegments.length - 1];
                const source = getSourceFromLink(irdInfo.link);
                if (source !== 'unknown') {
                    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
                }
                regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
                const bytes = parseInt(irdInfo['disc-size'], 10);
                const sizeText = formatSize(bytes);
                const titleEsc = escapeHtml(irdInfo.title);
                const titleFilterValue = CleanTitle(irdInfo.title);
                html += `<tr data-source="${source}" data-region="${region}">` +
                    `<td filter-value="${code.toLowerCase()}">${code}</td>` +
                    `<td filter-value="${escapeHtml(titleFilterValue)}">${titleEsc}</td>` +
                    `<td>${escapeHtml(irdInfo['app-ver'] ?? '')}</td>` +
                    `<td>${escapeHtml(irdInfo['game-ver'] ?? '')}</td>` +
                    `<td>${escapeHtml(irdInfo['fw-ver'] ?? '')}</td>` +
                    `<td>${irdInfo['file-count'] ?? ''}</td>` +
                    `<td data-bytes="${bytes}" title="${bytes.toLocaleString('en-US')} bytes (${sizeText})">${sizeText}</td>` +
                    `<td><a href="${downloadUrlBase}${irdInfo.link}" class="icon-link" download filename="${filename}" rel="external noopener" referrerpolicy="origin"><i class="bi bi-download"></i><span class="d-none d-xl-block"> ${escapeHtml(filename)}</span></a></td>` +
                    `</tr>`;
                irdCount++;
            }
            i++;
            if (i % CHUNK_SIZE === 0 || i === codeCount) {
                tbody.insertAdjacentHTML('beforeend', html);
                html = '';
                const value = (i * 100 / codeCount).toFixed(1);
                progressBar.ariaValueNow = value;
                progressStatus.textContent = `Processing… ${value}%`;
                progressStatus.style.width = `${value}%`;
                await Delay(0);
            }
        }
        progressBar.classList.add('d-none');
        const stat = document.getElementById('ird_count');
        stat.textContent = `${irdCount}`;
        BuildFilterDropdown('source_filter_list', 'source_filter_badge', SOURCES.filter(s => sourceCounts.has(s.id)).map(s => ({ id: s.id, label: `${s.label} (${sourceCounts.get(s.id)})` })), activeSources, Filter);
        BuildFilterDropdown('region_filter_list', 'region_filter_badge', REGIONS.filter(r => regionCounts.has(r.id)).map(r => ({ id: r.id, label: `${r.label} (${regionCounts.get(r.id)})` })), activeRegions, Filter);
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
window.onscroll = function () { scrollFunction(); };
function scrollFunction() {
    const btn = document.getElementById('scrollToTopBtn');
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        btn.style.display = 'block';
    }
    else {
        btn.style.display = 'none';
    }
}
function scrollToTop() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
}
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
        let aValue = a.cells[columnIndex].getAttribute('data-bytes') || a.cells[columnIndex].textContent?.trim() || '';
        let bValue = b.cells[columnIndex].getAttribute('data-bytes') || b.cells[columnIndex].textContent?.trim() || '';
        if (!isNaN(aValue) && !isNaN(bValue) && aValue !== '' && bValue !== '') {
            aValue = parseFloat(aValue);
            bValue = parseFloat(bValue);
        }
        if (order === SORT_ASC) {
            return aValue > bValue ? 1 : -1;
        }
        else {
            return aValue < bValue ? 1 : -1;
        }
    });
    const fragment = document.createDocumentFragment();
    rows.forEach(row => fragment.appendChild(row));
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}
function handleSort(event) {
    const target = event.target;
    const columnHeader = target.textContent?.trim() ?? '';
    const columnIndex = Array.from(target.parentNode.children).indexOf(target);
    let sortOrder;
    if (sortDirections[columnHeader] === SORT_ASC) {
        sortOrder = SORT_DESC;
    }
    else {
        sortOrder = SORT_ASC;
    }
    sortDirections[columnHeader] = sortOrder;
    target.parentNode.querySelectorAll('th').forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
    target.classList.add(`sorted-${sortOrder}`);
    sortTable(columnIndex, sortOrder);
}
document.querySelectorAll('#table th').forEach(th => th.addEventListener('click', handleSort));
//# sourceMappingURL=app.js.map