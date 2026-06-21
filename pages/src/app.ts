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

type SourceId = 'redump' | 'aldostools' | 'ps3ird';

interface SourceDef {
    id: SourceId;
    label: string;
    linkPrefix: string;
}

const SOURCES: SourceDef[] = [
    { id: 'redump', label: 'Redump', linkPrefix: 'Redump/' },
    { id: 'aldostools', label: 'aldostools', linkPrefix: 'ps3.aldostools.org/' },
    { id: 'ps3ird', label: "Zar's (ps3ird.free.fr)", linkPrefix: 'ps3ird.free.fr/' },
];

function getSourceFromLink(link: string): SourceId | 'unknown' {
    for (const src of SOURCES) {
        if (link.startsWith(src.linkPrefix)) {
            return src.id;
        }
    }
    return 'unknown';
}

type RegionId = 'EU' | 'US' | 'AS' | 'JP' | 'KR' | 'IN' | 'unknown';

interface RegionDef {
    id: RegionId;
    label: string;
}

const REGIONS: RegionDef[] = [
    { id: 'EU', label: 'Europe' },
    { id: 'US', label: 'America' },
    { id: 'AS', label: 'Asia' },
    { id: 'JP', label: 'Japan' },
    { id: 'KR', label: 'Korea' },
    { id: 'IN', label: 'International' },
    { id: 'unknown', label: 'Other / unknown' },
];

function getRegionFromId(id: string): RegionId {
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

const activeSources: Set<SourceId> = new Set();
const activeRegions: Set<RegionId> = new Set();

function BuildFilterDropdown<T extends string>(containerId: string, badgeId: string, items: { id: T, label: string }[], activeSet: Set<T>, onChange: () => void) {
    const container = document.getElementById(containerId) as HTMLElement;
    const badge = document.getElementById(badgeId) as HTMLElement;
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
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const value = cb.value as T;
            if (cb.checked) {
                activeSet.add(value);
            } else {
                activeSet.delete(value);
            }
            updateBadge();
            onChange();
        });
    });
    updateBadge();
}

let filterTimeout: number|null = null;
function Filter() {
    if (filterTimeout !== null) {
        clearTimeout(filterTimeout);
    }
    filterTimeout = setTimeout(() => {
        const filter = document.getElementById('filter') as HTMLInputElement;
        const val = filter.value?.toLowerCase().trim() ?? '';
        const normalizedVal = val.replace(/[-\s]/g, '');
        const table = document.getElementById('table') as HTMLTableElement;
        const tbody = table.tBodies[0];
        const stats = document.getElementById('ird_count') as HTMLSpanElement;
        const clearButton = document.getElementById('clear_button') as HTMLElement;

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
                visible = activeSources.has((row.getAttribute('data-source') || '') as SourceId);
            }

            if (visible && hasRegionFilter) {
                visible = activeRegions.has((row.getAttribute('data-region') || '') as RegionId);
            }

            row.classList.toggle('d-none', !visible);
            if (visible) {
                filtered++;
            }
        }

        if (hasTextFilter || hasSourceFilter || hasRegionFilter) {
            stats.textContent = `${filtered} of ${irdCount}`;
        } else {
            stats.textContent = `${irdCount}`;
        }
    }, 200);
}

function ClearFilter() {
    const clearFilterBtn = document.getElementById('clear_button') as HTMLButtonElement;
    clearFilterBtn.classList.add('d-none');
    const filter = document.getElementById('filter') as HTMLInputElement;
    filter.value = '';
    filter.onchange?.call(filter, new Event('change'));
}
function OnKb(event: KeyboardEvent) {
    if (event.code === 'Escape') {
        ClearFilter();
    }
}

class IrdInfo {
    title!: string;
    'fw-ver'!: string;
    'game-ver'!: string;
    'app-ver'!: string;
    'file-count'!: number;
    'disc-size'!: string;
    link!: string;
}

function formatSize(bytes: number): string {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return value.toFixed(2) + " " + sizes[i];
}

function escapeHtml(str: string): string {
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
        const progressBar = document.getElementById('loading_progress') as HTMLDivElement;
        const progressStatus = document.getElementById('loading_status') as HTMLDivElement;
        const tableContainer = document.getElementById('table_container') as HTMLDivElement;
        const table = document.getElementById('table') as HTMLTableElement;
        const tbody = table.tBodies[0];
        const codeCount = Object.keys(data).length;
        const sourceCounts = new Map<SourceId, number>();
        const regionCounts = new Map<RegionId, number>();

        let i = 0;
        let html = '';
        const CHUNK_SIZE = 500;

        for (const code in data) {
            const region = getRegionFromId(code);

            const irdInfoList = data[code] as IrdInfo[];
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
        const stat = document.getElementById('ird_count') as HTMLSpanElement;
        stat.textContent = `${irdCount}`;

        BuildFilterDropdown(
            'source_filter_list',
            'source_filter_badge',
            SOURCES.filter(s => sourceCounts.has(s.id)).map(s => ({ id: s.id, label: `${s.label} (${sourceCounts.get(s.id)})` })),
            activeSources,
            Filter
        );
        BuildFilterDropdown(
            'region_filter_list',
            'region_filter_badge',
            REGIONS.filter(r => regionCounts.has(r.id)).map(r => ({ id: r.id, label: `${r.label} (${regionCounts.get(r.id)})` })),
            activeRegions,
            Filter
        );

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

// scroll-to-top button
window.onscroll = function () { scrollFunction(); };
function scrollFunction() {
    const btn = document.getElementById('scrollToTopBtn') as HTMLElement;
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        btn.style.display = 'block';
    } else {
        btn.style.display = 'none';
    }
}
function scrollToTop() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
}

// sorting
const SORT_ASC = 'asc';
const SORT_DESC = 'desc';

let sortDirections: { [key: string]: string | null } = {
    'Product Code': null,
    'Title': null,
    'App Version': null,
    'Game Version': null,
    'Firmware Version': null,
    'Files': null,
    'Size': null
};

function sortTable(columnIndex: number, order: string) {
    const table = document.getElementById('table') as HTMLTableElement;
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);

    rows.sort((a, b) => {
        let aValue: string | number = a.cells[columnIndex].getAttribute('data-bytes') || a.cells[columnIndex].textContent?.trim() || '';
        let bValue: string | number = b.cells[columnIndex].getAttribute('data-bytes') || b.cells[columnIndex].textContent?.trim() || '';

        if (!isNaN(aValue as any) && !isNaN(bValue as any) && aValue !== '' && bValue !== '') {
            aValue = parseFloat(aValue as string);
            bValue = parseFloat(bValue as string);
        }

        if (order === SORT_ASC) {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });

    const fragment = document.createDocumentFragment();
    rows.forEach(row => fragment.appendChild(row));
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function handleSort(event: Event) {
    const target = event.target as HTMLElement;
    const columnHeader = target.textContent?.trim() ?? '';
    const columnIndex = Array.from(target.parentNode!.children).indexOf(target);
    let sortOrder: string;

    if (sortDirections[columnHeader] === SORT_ASC) {
        sortOrder = SORT_DESC;
    } else {
        sortOrder = SORT_ASC;
    }

    sortDirections[columnHeader] = sortOrder;
    target.parentNode!.querySelectorAll('th').forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
    target.classList.add(`sorted-${sortOrder}`);
    sortTable(columnIndex, sortOrder);
}
document.querySelectorAll('#table th').forEach(th => th.addEventListener('click', handleSort));