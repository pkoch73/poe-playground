/**
 * Innovation Dashboard Block
 * Displays innovation metrics, experiments, opportunities pipeline, and knowledge sharing
 * Data is fetched from a JSON file (Google Sheet export with multiple tabs)
 */

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
  wiContent.innerHTML = `
    <div class="metric-target">Target: ${wi.target || '-'}</div>
    <div class="metric-current">${wi.current || '-'}</div>
    <div class="metric-last-week">Last week: ${wi.lastWeek || '-'}</div>
    ${wi.current && wi.lastWeek ? `<div class="metric-trend ${wi.current >= wi.lastWeek ? 'trend-up' : 'trend-down'}">
      ${wi.current >= wi.lastWeek ? '▲' : '▼'} ${wi.current - wi.lastWeek} (${(((wi.current - wi.lastWeek) / wi.lastWeek) * 100).toFixed(1)}%)
    </div>` : ''}
  `;
  section.append(createMetricCard('Weekly Interactions', '📊', wiContent));

  // 2. Experiments Card
  const exp = metrics.experiments || {};
  const expContent = document.createElement('div');
  expContent.className = 'metric-values';
  const expPercent = exp.target && exp.current ? Math.round((exp.current / exp.target) * 100) : 0;
  expContent.innerHTML = `
    <div class="metric-target">Target: ${exp.target || '-'}</div>
    <div class="metric-current">${exp.current || '-'}</div>
    <div class="metric-percent">${expPercent}% of goal</div>
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
    <div class="metric-label">with usage data</div>
  `;
  section.append(createMetricCard('Customer Use', '👥', cuContent));

  // 4. Made to Product Card
  const mtp = metrics.madeToProduct || {};
  const mtpContent = document.createElement('div');
  mtpContent.className = 'metric-values';
  mtpContent.innerHTML = `<div class="metric-current">${mtp.current || '-'}</div>`;
  section.append(createMetricCard('Made to Product', '🚀', mtpContent));

  // 5. Knowledge Sharing Card
  const ks = metrics.knowledgeSharing || {};
  const ksContent = document.createElement('div');
  ksContent.className = 'metric-values';
  const ksPercent = ks.target && ks.current ? Math.round((ks.current / ks.target) * 100) : 0;
  ksContent.innerHTML = `
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${ksPercent}%"></div>
    </div>
    <div class="metric-progress">${ks.current || 0} / ${ks.target || 12}</div>
    <div class="metric-percent">${ksPercent}% of annual goal</div>
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
 * Renders the experiments table with filters
 * @param {Array} experimentsData - Experiments data from sheet
 * @returns {HTMLElement} - Experiments section element
 */
function renderExperiments(experimentsData) {
  const section = document.createElement('div');
  section.className = 'experiments-section';

  // Header with filters
  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `
    <h2>Experiments</h2>
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
      exp.customers.split(',').forEach((c) => customers.add(c.trim()));
    }
  });
  const customerSelect = header.querySelector('.filter-customer');
  customers.forEach((customer) => {
    const option = document.createElement('option');
    option.value = customer;
    option.textContent = customer;
    customerSelect.append(option);
  });

  // Table
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  table.className = 'experiments-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Title</th>
        <th>Description</th>
        <th>Success Function</th>
        <th>Usage</th>
        <th>Customers</th>
        <th>Status</th>
        <th>Learnings</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  function renderRows(data) {
    tbody.innerHTML = '';
    data.forEach((exp) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="col-title">${exp.title || ''}</td>
        <td class="col-description">${exp.description || ''}</td>
        <td class="col-success">${exp.successFunction || ''}</td>
        <td class="col-usage">${exp.usageData || ''}</td>
        <td class="col-customers">${exp.customers || ''}</td>
        <td class="col-status"></td>
        <td class="col-learnings">${exp.learnings || ''}</td>
      `;
      row.querySelector('.col-status').append(createStatusBadge(exp.status));
      tbody.append(row);
    });
  }

  renderRows(experimentsData);

  // Filter logic
  function applyFilters() {
    const statusFilter = header.querySelector('.filter-status').value;
    const customerFilter = header.querySelector('.filter-customer').value;

    const filtered = experimentsData.filter((exp) => {
      const statusMatch = !statusFilter || exp.status === statusFilter;
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
 * Renders the opportunities pipeline table derived from experiments data
 * @param {Array} experimentsData - Experiments data from sheet
 * @returns {HTMLElement} - Opportunities section element
 */
function renderOpportunities(experimentsData) {
  const section = document.createElement('div');
  section.className = 'opportunities-section';

  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = '<h2>Opportunities Pipeline</h2>';

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
  experimentsData.forEach((exp) => {
    const row = document.createElement('tr');

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

    tbody.append(row);
  });

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
  header.innerHTML = `<h2>Knowledge Sharing Artifacts</h2><span class="count">${artifactsData.length} of ${ksMetrics.target || 12}</span>`;

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
      <span class="artifact-date">${artifact.date || ''}</span>
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
  const ksMetrics = {};
  metricsData.forEach((row) => {
    if (row.metric === 'knowledgeSharing') {
      ksMetrics.current = row.current ? parseInt(row.current, 10) : 0;
      ksMetrics.target = row.target ? parseInt(row.target, 10) : 12;
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
  block.append(renderExperiments(experimentsData));
  block.append(renderCustomerUse(experimentsData));
  block.append(renderOpportunities(experimentsData));
  block.append(renderKnowledgeArtifacts(artifactsData, ksMetrics));
}
