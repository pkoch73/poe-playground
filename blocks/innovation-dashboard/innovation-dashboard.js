/**
 * Innovation Dashboard Block
 * Displays innovation metrics, experiments, opportunities pipeline, and knowledge sharing
 * Data is fetched from a JSON file (Google Sheet export with multiple tabs)
 */

/**
 * Converts an Excel serial date number to a formatted date string
 * Excel serial dates count days since December 30, 1899
 * @param {number|string} serial - Excel serial date or date string
 * @returns {string} - Formatted date string (e.g., "Apr 1, 2025")
 */
function formatDate(serial) {
  if (!serial) return '';

  // If it's already a date string, return it
  if (typeof serial === 'string' && serial.includes('-')) {
    const d = new Date(serial);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return serial;
  }

  // Convert Excel serial to JS Date
  const num = parseInt(serial, 10);
  if (Number.isNaN(num)) return serial;

  // Excel epoch is December 30, 1899
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Fetches all sheet data from a JSON file
 * Supports both multi-sheet format (all in one JSON) and single-sheet format (query params)
 * @param {string} jsonPath - Path to the JSON file
 * @returns {Promise<Object>} - Object with metrics, experiments, opportunities, artifacts arrays
 */
async function fetchAllSheetData(jsonPath) {
  try {
    const response = await fetch(jsonPath);
    if (!response.ok) throw new Error(`Failed to fetch ${jsonPath}`);
    const json = await response.json();

    // Check if this is a multi-sheet format
    if (json[':type'] === 'multi-sheet') {
      // Multi-sheet: all data is in one JSON with sheet names as properties
      return {
        metrics: json.metrics?.data || [],
        experiments: json.experiments?.data || [],
        opportunities: json.opportunities?.data || [],
        artifacts: json.knowledgeArtifacts?.data || [],
      };
    }

    // Single-sheet format: need to fetch each sheet separately
    const fetchSheet = async (sheet) => {
      const url = sheet ? `${jsonPath}?sheet=${sheet}` : jsonPath;
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.data || [];
    };

    const [metrics, experiments, opportunities, artifacts] = await Promise.all([
      fetchSheet('shared-metrics'),
      fetchSheet('shared-experiments'),
      fetchSheet('shared-opportunities'),
      fetchSheet('shared-knowledgeArtifacts'),
    ]);

    return {
      metrics, experiments, opportunities, artifacts,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching sheet data:', error);
    return {
      metrics: [], experiments: [], opportunities: [], artifacts: [],
    };
  }
}

/**
 * Creates a metric card element
 * @param {string} title - Card title
 * @param {string} icon - Emoji icon
 * @param {HTMLElement} content - Card content element
 * @returns {HTMLElement} - Metric card element
 */
function createMetricCard(title, icon, content) {
  const card = document.createElement('div');
  card.className = 'metric-card';

  const header = document.createElement('div');
  header.className = 'metric-card-header';
  header.innerHTML = `<span class="metric-icon">${icon}</span><span class="metric-title">${title}</span>`;

  const body = document.createElement('div');
  body.className = 'metric-card-body';
  body.append(content);

  card.append(header, body);
  return card;
}

/**
 * Renders the metrics cards section
 * @param {Array} metricsData - Metrics data from sheet
 * @param {Array} experimentsData - Experiments data for customer count
 * @returns {HTMLElement} - Metrics section element
 */
function renderMetrics(metricsData, experimentsData) {
  const section = document.createElement('div');
  section.className = 'metrics-section';

  // Parse metrics into a lookup object
  const metrics = {};
  metricsData.forEach((row) => {
    metrics[row.metric] = {
      target: row.target ? parseInt(row.target, 10) : null,
      current: row.current ? parseInt(row.current, 10) : null,
      lastWeek: row.lastWeek ? parseInt(row.lastWeek, 10) : null,
    };
  });

  // 1. Weekly Interactions Card
  const wi = metrics.weeklyInteractions || {};
  const wiContent = document.createElement('div');
  wiContent.className = 'metric-values';
  const wiPercent = wi.target && wi.current ? Math.round((wi.current / wi.target) * 100) : 0;
  wiContent.innerHTML = `
    ${wi.target ? `<div class="metric-target">Target: ${wi.target}</div>` : ''}
    <div class="metric-current">${wi.current || '-'}</div>
    ${wi.target ? `<div class="metric-percent">${wiPercent}% of annual goal</div>` : ''}
    <div class="metric-secondary">Last week: ${wi.lastWeek || '-'}${wi.current && wi.lastWeek ? ` <span class="metric-trend ${wi.current >= wi.lastWeek ? 'trend-up' : 'trend-down'}">${wi.current >= wi.lastWeek ? '▲' : '▼'} ${Math.abs(wi.current - wi.lastWeek)}</span>` : ''}</div>
  `;
  section.append(createMetricCard('Weekly Interactions', '📊', wiContent));

  // 2. Experiments Card
  const exp = metrics.experiments || {};
  const expContent = document.createElement('div');
  expContent.className = 'metric-values';
  const expPercent = exp.target && exp.current ? Math.round((exp.current / exp.target) * 100) : 0;
  expContent.innerHTML = `
    ${exp.target ? `<div class="metric-target">Target: ${exp.target}</div>` : ''}
    <div class="metric-current">${exp.current || '-'}</div>
    ${exp.target ? `<div class="metric-percent">${expPercent}% of annual goal</div>` : ''}
  `;
  section.append(createMetricCard('Experiments', '🧪', expContent));

  // 3. Customer Use Card (experiments with usage data)
  const customerUseCount = experimentsData.filter((e) => {
    const usage = (e.usageData || '').trim().toLowerCase();
    return usage !== '' && usage !== '0';
  }).length;
  const cuContent = document.createElement('div');
  cuContent.className = 'metric-values';
  cuContent.innerHTML = `
    <div class="metric-current">${customerUseCount}</div>
    <div class="metric-label">experiments with usage</div>
  `;
  section.append(createMetricCard('Customer Use', '👥', cuContent));

  // 4. Made to Product Card
  const mtp = metrics.madeToProduct || {};
  const mtpContent = document.createElement('div');
  mtpContent.className = 'metric-values';
  const mtpPercent = mtp.target && mtp.current ? Math.round((mtp.current / mtp.target) * 100) : 0;
  mtpContent.innerHTML = `
    ${mtp.target ? `<div class="metric-target">Target: ${mtp.target}</div>` : ''}
    <div class="metric-current">${mtp.current || '-'}</div>
    ${mtp.target ? `<div class="metric-percent">${mtpPercent}% of annual goal</div>` : ''}
  `;
  section.append(createMetricCard('Made to Product', '🚀', mtpContent));

  // 5. Knowledge Sharing Card
  const ks = metrics.knowledgeSharing || {};
  const ksContent = document.createElement('div');
  ksContent.className = 'metric-values';
  const ksPercent = ks.target && ks.current ? Math.round((ks.current / ks.target) * 100) : 0;
  ksContent.innerHTML = `
    ${ks.target ? `<div class="metric-target">Target: ${ks.target}</div>` : ''}
    <div class="metric-current">${ks.current || '-'}</div>
    ${ks.target ? `<div class="metric-percent">${ksPercent}% of annual goal</div>` : ''}
  `;
  section.append(createMetricCard('Knowledge Sharing', '📚', ksContent));

  return section;
}

/**
 * Creates a status badge element
 * @param {string} status - Status string
 * @returns {HTMLElement} - Badge element
 */
function createStatusBadge(status) {
  const badge = document.createElement('span');
  badge.className = 'status-badge';
  const statusLower = (status || '').toLowerCase();

  if (statusLower.includes('auto solve') || statusLower === 'yes') {
    badge.classList.add('status-success');
    badge.textContent = `✅ ${status}`;
  } else if (statusLower === 'wip') {
    badge.classList.add('status-wip');
    badge.textContent = `🔵 ${status}`;
  } else if (statusLower === 'no') {
    badge.classList.add('status-no');
    badge.textContent = `❌ ${status}`;
  } else if (statusLower === 'learn') {
    badge.classList.add('status-learn');
    badge.textContent = `🔄 ${status}`;
  } else if (statusLower === 'understand') {
    badge.classList.add('status-understand');
    badge.textContent = `📖 ${status}`;
  } else if (statusLower === 'hypothesis') {
    badge.classList.add('status-hypothesis');
    badge.textContent = `💡 ${status}`;
  } else {
    badge.classList.add('status-unknown');
    badge.textContent = status || 'Unknown';
  }

  return badge;
}

/**
 * Checks if usageData field has a meaningful value
 * @param {string} usageData - The usage data value
 * @returns {boolean} - True if usage data is set
 */
function hasUsageData(usageData) {
  if (!usageData) return false;
  const trimmed = usageData.trim().toLowerCase();
  return trimmed !== '' && trimmed !== '0';
}

/**
 * Renders experiments with customer use section
 * @param {Array} experimentsData - Experiments data from sheet
 * @returns {HTMLElement} - Customer use section element
 */
function renderCustomerUse(experimentsData) {
  const withUsage = experimentsData.filter((e) => hasUsageData(e.usageData));

  const section = document.createElement('div');
  section.className = 'customer-use-section';

  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `<h2>Experiments with Customer Use (≥1)</h2><span class="count">${withUsage.length} total</span>`;

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  table.className = 'customer-use-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Title</th>
        <th>Customers</th>
        <th>Usage Data</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  withUsage.forEach((exp) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${exp.title || ''}</td>
      <td>${exp.customers || ''}</td>
      <td>${exp.usageData || ''}</td>
      <td class="col-status"></td>
    `;
    row.querySelector('.col-status').append(createStatusBadge(exp.status));
    tbody.append(row);
  });

  tableWrapper.append(table);
  section.append(header, tableWrapper);
  return section;
}

/**
 * Stage progression order for deriving pipeline from status
 */
const STAGE_ORDER = ['unknown', 'learn', 'understand', 'hypothesis', 'auto solve'];

/**
 * Derives stage completion based on current status
 * @param {string} status - Current experiment status
 * @param {string} stage - Stage to check
 * @returns {string} - 'yes', 'wip', or 'no'
 */
function getStageStatus(status, stage) {
  const statusLower = (status || '').toLowerCase();
  const currentIndex = STAGE_ORDER.indexOf(statusLower);
  const stageIndex = STAGE_ORDER.indexOf(stage);

  // Handle WIP as between hypothesis and auto solve
  if (statusLower === 'wip') {
    if (stageIndex <= 3) return 'yes'; // hypothesis and before
    return 'wip'; // auto solve column shows WIP
  }

  if (currentIndex === -1) return 'no'; // Unknown status
  if (stageIndex < currentIndex) return 'yes'; // Completed stage
  if (stageIndex === currentIndex) return 'yes'; // Current stage
  return 'no'; // Future stage
}

/**
 * Creates a stage cell for the opportunities pipeline
 * @param {string} value - Stage value (yes, no, wip)
 * @returns {HTMLElement} - Cell element
 */
function createStageCell(value) {
  const cell = document.createElement('td');
  cell.className = 'stage-cell';
  const val = (value || '').toLowerCase();

  if (val === 'yes') {
    cell.classList.add('stage-yes');
    cell.textContent = '✓';
  } else if (val === 'wip') {
    cell.classList.add('stage-wip');
    cell.textContent = 'WIP';
  } else {
    cell.classList.add('stage-no');
    cell.textContent = '✗';
  }

  return cell;
}

/**
 * Calculates completion score based on status for sorting
 * Higher score = more stages completed
 * @param {string} status - Experiment status
 * @returns {number} - Completion score
 */
function getCompletionScore(status) {
  const statusLower = (status || '').toLowerCase();
  const scores = {
    'auto solve': 5,
    wip: 4.5,
    hypothesis: 4,
    understand: 3,
    learn: 2,
    unknown: 1,
  };
  return scores[statusLower] || 0;
}

/**
 * Creates and shows a modal with experiment details
 * @param {Object} exp - Experiment data
 * @param {HTMLElement} section - Parent section for modal
 */
function showExperimentModal(exp, section) {
  // Remove existing modal if any
  const existingModal = section.querySelector('.experiment-modal-overlay');
  if (existingModal) existingModal.remove();

  const stages = ['Unknown', 'Learn', 'Understand', 'Hypothesis', 'Auto Solve'];
  const stageProgress = stages.map((stage) => {
    const status = getStageStatus(exp.status, stage.toLowerCase());
    if (status === 'yes') return `✓ ${stage}`;
    if (status === 'wip') return `🔵 ${stage}`;
    return `✗ ${stage}`;
  }).join(' → ');

  const overlay = document.createElement('div');
  overlay.className = 'experiment-modal-overlay';
  overlay.innerHTML = `
    <div class="experiment-modal">
      <div class="modal-header">
        <h3>${exp.title || 'Experiment'}</h3>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-field">
          <label>Status</label>
          <div class="modal-status"></div>
        </div>
        <div class="modal-field">
          <label>Description</label>
          <p>${exp.description || '-'}</p>
        </div>
        <div class="modal-field">
          <label>Success Function</label>
          <p>${exp.successFunction || '-'}</p>
        </div>
        <div class="modal-field">
          <label>Usage Data</label>
          <p>${exp.usageData || '-'}</p>
        </div>
        <div class="modal-field">
          <label>Customers</label>
          <p>${exp.customers || '-'}</p>
        </div>
        <div class="modal-field">
          <label>Learnings</label>
          <p>${exp.learnings || '-'}</p>
        </div>
        <div class="modal-field">
          <label>Stage Progression</label>
          <p class="stage-progress">${stageProgress}</p>
        </div>
      </div>
    </div>
  `;

  // Add status badge
  overlay.querySelector('.modal-status').append(createStatusBadge(exp.status));

  // Close handlers
  const closeModal = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  section.append(overlay);
}

/**
 * Renders the opportunities pipeline table derived from experiments data
 * @param {Array} experimentsData - Experiments data from sheet
 * @returns {HTMLElement} - Opportunities section element
 */
function renderOpportunities(experimentsData) {
  const section = document.createElement('div');
  section.className = 'opportunities-section';

  // Header with filters
  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `
    <h2>Pancake chart</h2>
    <div class="filters">
      <select class="filter-status">
        <option value="">All Status</option>
        <option value="Auto Solve">Auto Solve</option>
        <option value="WIP">WIP</option>
        <option value="Hypothesis">Hypothesis</option>
        <option value="Learn">Learn</option>
        <option value="Understand">Understand</option>
        <option value="Unknown">Unknown</option>
      </select>
      <select class="filter-customer">
        <option value="">All Customers</option>
      </select>
    </div>
  `;

  // Populate customer filter
  const customers = new Set();
  experimentsData.forEach((exp) => {
    if (exp.customers) {
      exp.customers.split(',').forEach((c) => {
        const trimmed = c.trim();
        if (trimmed) customers.add(trimmed);
      });
    }
  });
  const customerSelect = header.querySelector('.filter-customer');
  [...customers].sort().forEach((customer) => {
    const option = document.createElement('option');
    option.value = customer;
    option.textContent = customer;
    customerSelect.append(option);
  });

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  table.className = 'opportunities-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Opportunity</th>
        <th>Unknown</th>
        <th>Learn</th>
        <th>Understand</th>
        <th>Hypothesis</th>
        <th>Auto Solve</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  function renderRows(data) {
    tbody.innerHTML = '';

    // Sort by completion score (most complete first)
    const sorted = [...data].sort(
      (a, b) => getCompletionScore(b.status) - getCompletionScore(a.status),
    );

    sorted.forEach((exp) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');

      const titleCell = document.createElement('td');
      titleCell.className = 'col-opportunity';
      titleCell.textContent = exp.title || '';
      row.append(titleCell);

      // Derive stage completion from status
      row.append(createStageCell(getStageStatus(exp.status, 'unknown')));
      row.append(createStageCell(getStageStatus(exp.status, 'learn')));
      row.append(createStageCell(getStageStatus(exp.status, 'understand')));
      row.append(createStageCell(getStageStatus(exp.status, 'hypothesis')));
      row.append(createStageCell(getStageStatus(exp.status, 'auto solve')));

      // Click handler for modal
      row.addEventListener('click', () => showExperimentModal(exp, section));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showExperimentModal(exp, section);
        }
      });

      tbody.append(row);
    });
  }

  renderRows(experimentsData);

  // Filter logic
  function applyFilters() {
    const statusFilter = header.querySelector('.filter-status').value;
    const customerFilter = header.querySelector('.filter-customer').value;

    const filtered = experimentsData.filter((exp) => {
      const statusLower = (exp.status || '').toLowerCase();
      const filterLower = statusFilter.toLowerCase();
      const statusMatch = !statusFilter || statusLower === filterLower;
      const hasCustomer = exp.customers && exp.customers.includes(customerFilter);
      const customerMatch = !customerFilter || hasCustomer;
      return statusMatch && customerMatch;
    });

    renderRows(filtered);
  }

  header.querySelector('.filter-status').addEventListener('change', applyFilters);
  header.querySelector('.filter-customer').addEventListener('change', applyFilters);

  tableWrapper.append(table);
  section.append(header, tableWrapper);
  return section;
}

/**
 * Renders the knowledge artifacts section
 * @param {Array} artifactsData - Knowledge artifacts data from sheet
 * @param {Object} ksMetrics - Knowledge sharing metrics
 * @returns {HTMLElement} - Knowledge artifacts section element
 */
function renderKnowledgeArtifacts(artifactsData, ksMetrics) {
  const section = document.createElement('div');
  section.className = 'knowledge-section';

  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `<h2>Knowledge Sharing Artifacts</h2><span class="count">${artifactsData.length} of ${ksMetrics.target}</span>`;

  const list = document.createElement('div');
  list.className = 'artifacts-list';

  const typeIcons = {
    blog: '📝',
    briefing: '🎤',
    slack: '💬',
    email: '📧',
    video: '🎬',
    workshop: '🛠️',
  };

  artifactsData.forEach((artifact) => {
    const item = document.createElement('div');
    item.className = 'artifact-item';

    const icon = typeIcons[(artifact.type || '').toLowerCase()] || '📄';
    const hasLink = artifact.link && artifact.link.trim();

    item.innerHTML = `
      <span class="artifact-icon">${icon}</span>
      <span class="artifact-type">${artifact.type || ''}</span>
      <span class="artifact-title">${artifact.title || ''}</span>
      <span class="artifact-date">${formatDate(artifact.date)}</span>
      <span class="artifact-channel">${artifact.channel || ''}</span>
      ${hasLink ? `<a href="${artifact.link}" class="artifact-link">→</a>` : ''}
    `;

    list.append(item);
  });

  section.append(header, list);
  return section;
}

/**
 * Main decoration function for the innovation-dashboard block
 * @param {Element} block - The block element
 */
export default async function decorate(block) {
  // Get the JSON path from the block content
  const pathCell = block.querySelector('div > div');
  const jsonPath = pathCell?.textContent?.trim() || '';

  if (!jsonPath) {
    block.innerHTML = '<p class="error">No data path provided. Please add a path to your innovation data JSON.</p>';
    return;
  }

  // Show loading state
  block.innerHTML = '<div class="loading">Loading innovation data...</div>';

  // Fetch all sheet data (handles both multi-sheet and single-sheet formats)
  const {
    metrics: metricsData,
    experiments: experimentsData,
    artifacts: artifactsData,
  } = await fetchAllSheetData(jsonPath);

  // Parse knowledge sharing metrics for the artifacts section
  const ksMetrics = { current: 0, target: 0 };
  metricsData.forEach((row) => {
    if (row.metric === 'knowledgeSharing') {
      ksMetrics.current = row.current ? parseInt(row.current, 10) : 0;
      ksMetrics.target = row.target ? parseInt(row.target, 10) : 0;
    }
  });

  // Clear loading state
  block.innerHTML = '';

  // Add dashboard title
  const title = document.createElement('h1');
  title.className = 'dashboard-title';
  title.textContent = 'Innovation Dashboard';
  block.append(title);

  // Render all sections
  block.append(renderMetrics(metricsData, experimentsData));
  block.append(renderOpportunities(experimentsData));
  block.append(renderCustomerUse(experimentsData));
  block.append(renderKnowledgeArtifacts(artifactsData, ksMetrics));
}
