/* Go-Forth HVAC Plumbing & Electrical — GGOB Dashboard Application */
(function() {
  'use strict';

  let DASHBOARD_DATA = null;

  // Formatting helpers
  function money(val) {
    if (val === null || val === undefined || isNaN(val)) return '$0';
    const num = Math.round(Number(val));
    return '$' + num.toLocaleString('en-US');
  }

  function money2(val) {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function num(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Math.round(Number(val)).toLocaleString('en-US');
  }

  function pct(val) {
    if (val === null || val === undefined || isNaN(val)) return '0.0%';
    return Number(val).toFixed(1) + '%';
  }

  // Load and render
  async function init() {
    const dataUrl = (window.HVAC_CONFIG && window.HVAC_CONFIG.DATA_URL) || 'data.json';
    try {
      const resp = await fetch(dataUrl);
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' loading ' + dataUrl);
      DASHBOARD_DATA = await resp.json();
      renderDashboard(DASHBOARD_DATA);
      setupTabListeners();
      setupSimulator();
    } catch (err) {
      console.error('Error loading HVAC dashboard:', err);
      const main = document.querySelector('main');
      if (main) {
        main.innerHTML = '<div class="card" style="text-align:center; padding:40px; color:#e74c3c;"><h3>Error Loading Dashboard</h3><p>' + err.message + '</p></div>';
      }
    }
  }

  function renderDashboard(data) {
    const s = data.summary_kpis;
    
    // Header As-Of Date
    const asOfElem = document.getElementById('as-of-date-label');
    if (asOfElem) asOfElem.textContent = data.period_label || data.as_of_date;

    // Critical Number Margin Progress Bar
    const gmProgress = document.getElementById('gm-progress-bar');
    const gmLabel = document.getElementById('gm-current-label');
    const critBadge = document.getElementById('critical-number-badge');
    if (gmProgress && gmLabel) {
      const widthPct = Math.min(100, Math.max(0, (s.ytd_gross_margin_pct / s.target_margin_pct) * 100));
      gmProgress.style.width = widthPct.toFixed(1) + '%';
      gmLabel.textContent = '2026 YTD Margin: ' + pct(s.ytd_gross_margin_pct) + ' (June Peak: ' + pct(s.june_peak_margin_pct) + ' | July: ' + pct(s.july_margin_pct) + ')';
      if (critBadge) {
        critBadge.textContent = pct(s.june_peak_margin_pct) + ' Peak (Target: ' + pct(s.target_margin_pct) + '+)';
      }
    }

    // 1. Executive Arena Scorecards
    const execKpis = document.getElementById('exec-kpis');
    if (execKpis) {
      execKpis.innerHTML = `
        <div class="kpi-card gold">
          <div class="kpi-label">Total Billed Revenue (L12M)</div>
          <div class="kpi-val">${money(s.l12m_revenue)}</div>
          <div class="kpi-meta"><span class="up">+${pct(s.yoy_growth_l12m_pct)} YoY Growth</span> (PY: ${money(s.py_l12m_revenue)})</div>
        </div>
        <div class="kpi-card cyan">
          <div class="kpi-label">2026 YTD Revenue</div>
          <div class="kpi-val">${money(s.ytd_revenue)}</div>
          <div class="kpi-meta"><span class="up">+${pct(s.yoy_growth_ytd_pct)} YoY</span> (PY YTD: ${money(s.py_ytd_revenue)})</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-label">Active Maintenance Members</div>
          <div class="kpi-val">${num(s.active_maintenance_members)}</div>
          <div class="kpi-meta"><span class="up">+${num(s.active_maintenance_members - s.active_maintenance_py)} Net Adds</span> (PY: ${num(s.active_maintenance_py)})</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-label">Monthly Recurring (MRR)</div>
          <div class="kpi-val">${money(s.mrr)} / mo</div>
          <div class="kpi-meta"><span class="up">${money(s.arr)} ARR</span> (100% 30-day billing)</div>
        </div>
        <div class="kpi-card red">
          <div class="kpi-label">Uncollected Cash (Open AR)</div>
          <div class="kpi-val">${money(s.ar_open)}</div>
          <div class="kpi-meta">Money Left on Field (Target: < $100k)</div>
        </div>
        <div class="kpi-card gold">
          <div class="kpi-label">Team Draw Success</div>
          <div class="kpi-val">${pct(s.draw_success_rate_pct)}</div>
          <div class="kpi-meta"><span class="up">0 Draw Misses</span> in June & July (${num(s.team_headcount)} staff)</div>
        </div>
      `;
    }

    // Monthly Rounds Table
    const roundsTbody = document.getElementById('rounds-tbody');
    const roundsTfoot = document.getElementById('rounds-tfoot');
    if (roundsTbody && data.monthly_rounds) {
      roundsTbody.innerHTML = data.monthly_rounds.map(r => {
        let badgeClass = 'in-reach';
        let badgeText = 'In Reach';
        if (r.status === 'record-win') { badgeClass = 'record'; badgeText = '🔥 All-Time High'; }
        else if (r.status === 'win') { badgeClass = 'win'; badgeText = '🟢 Win'; }
        else if (r.gross_margin_pct >= 35) { badgeClass = 'win'; badgeText = '🛡️ Margin Win'; }

        return `
          <tr>
            <td><strong>Round ${r.round}: ${r.label}</strong></td>
            <td class="num">$${num(r.revenue / 1000)}k</td>
            <td class="num"><span class="${r.growth_pct >= 0 ? 'up' : 'down'}">${r.growth_pct >= 0 ? '+' : ''}${pct(r.growth_pct)}</span></td>
            <td class="num"><strong>${pct(r.gross_margin_pct)}</strong></td>
            <td class="num">${r.ebitda >= 0 ? '$' + num(r.ebitda/1000) + 'k' : '-$' + num(Math.abs(r.ebitda)/1000) + 'k'}</td>
            <td class="num">$${num(r.ar / 1000)}k</td>
            <td class="num">${num(r.service_jobs)}</td>
            <td class="num">${num(r.plumbing_jobs)}</td>
            <td class="num">${num(r.maint_members)}</td>
            <td class="num">${num(r.headcount)}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          </tr>
        `;
      }).join('');

      if (roundsTfoot) {
        roundsTfoot.innerHTML = `
          <tr>
            <td><strong>L12M Total / Averages</strong></td>
            <td class="num">${money(s.l12m_revenue)}</td>
            <td class="num">+${pct(s.yoy_growth_l12m_pct)}</td>
            <td class="num">${pct(s.l12m_gross_margin_pct)}</td>
            <td class="num">-$199k</td>
            <td class="num">${money(s.ar_open)}</td>
            <td class="num">617 runs</td>
            <td class="num">227 jobs</td>
            <td class="num">${num(s.active_maintenance_members)} active</td>
            <td class="num">${num(s.team_headcount)} staff</td>
            <td><span class="badge win">58% YoY Growth</span></td>
          </tr>
        `;
      }
    }

    // 2. Branch Arena
    const branchKpis = document.getElementById('branch-kpis');
    if (branchKpis && data.branches) {
      branchKpis.innerHTML = data.branches.slice(0, 4).map(b => `
        <div class="kpi-card">
          <div class="kpi-label">#${b.rank} ${b.name}</div>
          <div class="kpi-val">${money(b.ytd_revenue)}</div>
          <div class="kpi-meta">${pct(b.revenue_share_pct)} of Company • ${num(b.invoices_ytd)} jobs • ${num(b.active_members)} members</div>
        </div>
      `).join('');
    }

    const branchTbody = document.getElementById('branch-tbody');
    const branchTfoot = document.getElementById('branch-tfoot');
    if (branchTbody && data.branches) {
      branchTbody.innerHTML = data.branches.map(b => `
        <tr>
          <td><strong>#${b.rank}</strong></td>
          <td><strong>${b.name}</strong></td>
          <td><span style="font-size:0.8rem; color:var(--text-muted);">${b.cities}</span></td>
          <td class="num"><strong>${money2(b.ytd_revenue)}</strong></td>
          <td class="num">${pct(b.revenue_share_pct)}</td>
          <td class="num">${num(b.invoices_ytd)}</td>
          <td class="num">${money2(b.avg_ticket)}</td>
          <td class="num">${num(b.active_members)}</td>
          <td class="num">${pct(b.gross_margin_est_pct)}</td>
          <td><span class="badge ${b.status === 'leader' ? 'win' : 'in-reach'}">${b.status.toUpperCase()}</span></td>
        </tr>
      `).join('');

      if (branchTfoot) {
        const totalRev = data.branches.reduce((acc, b) => acc + b.ytd_revenue, 0);
        const totalInv = data.branches.reduce((acc, b) => acc + b.invoices_ytd, 0);
        const totalMem = data.branches.reduce((acc, b) => acc + b.active_members, 0);
        branchTfoot.innerHTML = `
          <tr>
            <td colspan="3"><strong>Total Operating Network</strong></td>
            <td class="num"><strong>${money2(totalRev)}</strong></td>
            <td class="num">100.0%</td>
            <td class="num">${num(totalInv)}</td>
            <td class="num">${money2(totalRev / totalInv)}</td>
            <td class="num">${num(totalMem)}</td>
            <td class="num">28.8%</td>
            <td><span class="badge win">5 Territories</span></td>
          </tr>
        `;
      }
    }

    // 3. Recurring Fortress
    const rec = data.recurring;
    const maintProgress = document.getElementById('maint-progress-bar');
    const maintLabel = document.getElementById('maint-current-label');
    if (maintProgress && maintLabel) {
      maintProgress.style.width = pct(rec.quest_progress_pct);
      maintLabel.textContent = 'Current Active Base: ' + num(rec.active_members) + ' Members (' + pct(rec.quest_progress_pct) + ' of Quest)';
    }

    const recKpis = document.getElementById('recurring-kpis');
    if (recKpis) {
      recKpis.innerHTML = `
        <div class="kpi-card gold">
          <div class="kpi-label">Monthly Recurring Revenue (MRR)</div>
          <div class="kpi-val">${money2(rec.mrr)}</div>
          <div class="kpi-meta">Predictable cash flow arriving every 30 days</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-label">Annualized Run-Rate (ARR)</div>
          <div class="kpi-val">${money2(rec.arr)}</div>
          <div class="kpi-meta"><span class="up">+${money(rec.arr - (1071 * 15.79 * 12))} ARR</span> added in 2026</div>
        </div>
        <div class="kpi-card cyan">
          <div class="kpi-label">Average Agreement Value</div>
          <div class="kpi-val">${money2(rec.avg_mrr_per_sub)} / mo</div>
          <div class="kpi-meta">${money2(rec.avg_arr_per_sub)} / member / year</div>
        </div>
        <div class="kpi-card red">
          <div class="kpi-label">2026 Churn MRR Lost</div>
          <div class="kpi-val">${money(data.cancellations.comfort_guard_mrr_lost_2026)}</div>
          <div class="kpi-meta">${num(data.cancellations.comfort_guard_cxls_2026)} agreements lost (target: save 20%)</div>
        </div>
      `;
    }

    // Pricing Tiers
    const tiersTbody = document.getElementById('tiers-tbody');
    if (tiersTbody && rec.pricing_tiers) {
      tiersTbody.innerHTML = rec.pricing_tiers.map(t => `
        <tr>
          <td><strong>${t.name}</strong></td>
          <td class="num">${money2(t.price_monthly)}</td>
          <td class="num">${num(t.count)}</td>
          <td class="num"><strong>${money2(t.mrr)}</strong></td>
          <td class="num">${pct(t.share_pct)}</td>
        </tr>
      `).join('');
    }

    // Cancellations Table
    const cxlTbody = document.getElementById('cxl-tbody');
    if (cxlTbody && data.cancellations && data.cancellations.reasons) {
      cxlTbody.innerHTML = data.cancellations.reasons.map(r => `
        <tr>
          <td><strong>${r.reason}</strong></td>
          <td class="num">${num(r.cg_count)}</td>
          <td class="num">${pct(r.pct_of_cg)}</td>
          <td><span style="font-size:0.8rem; color:var(--brand-cyan);">${r.action}</span></td>
        </tr>
      `).join('');
    }

    // 4. Tech Champions League
    const techTbody = document.getElementById('tech-tbody');
    const techTfoot = document.getElementById('tech-tfoot');
    if (techTbody && data.tech_leaderboard) {
      techTbody.innerHTML = data.tech_leaderboard.map(t => `
        <tr>
          <td><strong>#${t.rank}</strong></td>
          <td><strong>${t.name}</strong></td>
          <td>${t.role}</td>
          <td><span class="badge ${t.rank <= 3 ? 'record' : 'in-reach'}">${t.badge}</span></td>
          <td class="num"><strong>${money2(t.total_sold)}</strong></td>
          <td class="num">${num(t.sales_count)}</td>
          <td class="num"><strong>${money2(t.avg_ticket)}</strong></td>
          <td class="num">${num(t.completed_stops)}</td>
          <td class="num">${num(t.cg_sold)}</td>
          <td class="num">${num(t.installs)}</td>
          <td class="num">${num(t.parts_jobs + t.plumbing_jobs)}</td>
          <td><span class="badge win">${t.draw_status}</span></td>
        </tr>
      `).join('');

      if (techTfoot) {
        const totalSold = data.tech_leaderboard.reduce((acc, t) => acc + t.total_sold, 0);
        const totalDeals = data.tech_leaderboard.reduce((acc, t) => acc + t.sales_count, 0);
        const totalStops = data.tech_leaderboard.reduce((acc, t) => acc + t.completed_stops, 0);
        const totalCG = data.tech_leaderboard.reduce((acc, t) => acc + t.cg_sold, 0);
        techTfoot.innerHTML = `
          <tr>
            <td colspan="4"><strong>Total Field Production Force</strong></td>
            <td class="num"><strong>${money2(totalSold)}</strong></td>
            <td class="num">${num(totalDeals)}</td>
            <td class="num">${money2(totalSold / totalDeals)}</td>
            <td class="num">${num(totalStops)}</td>
            <td class="num">${num(totalCG)}</td>
            <td class="num">70</td>
            <td class="num">500</td>
            <td><span class="badge win">100% Pass</span></td>
          </tr>
        `;
      }
    }

    // Inside Sales Table
    const insideTbody = document.getElementById('inside-tbody');
    if (insideTbody && data.inside_sales_leaderboard) {
      insideTbody.innerHTML = data.inside_sales_leaderboard.map(i => `
        <tr>
          <td><strong>#${i.rank}</strong></td>
          <td><strong>${i.name}</strong></td>
          <td class="num"><strong>${num(i.cg_sold)} plans</strong></td>
          <td class="num">${money2(i.total_volume)}</td>
          <td class="num"><strong>+${money2(i.mrr_added)} / mo</strong></td>
          <td class="num">${money2(i.avg_ticket)}</td>
        </tr>
      `).join('');
    }

    // 5. MiniGames Grid
    const mgGrid = document.getElementById('minigames-grid');
    if (mgGrid && data.minigames) {
      mgGrid.innerHTML = data.minigames.map(m => `
        <div class="minigame-card ${m.status === 'won-streak' ? 'won' : 'active'}">
          <div>
            <div class="mg-header">
              <div class="mg-icon">${m.icon}</div>
              <div>
                <div class="mg-title">${m.title}</div>
                <div class="mg-subtitle">${m.subtitle}</div>
              </div>
            </div>
            <div class="progress-wrap">
              <div class="progress-labels">
                <span>Current: ${typeof m.current === 'number' && m.current > 1000 ? (m.unit.includes('$') ? money(m.current) : num(m.current)) : m.current + (m.unit.includes('%') ? '%' : '')}</span>
                <span>Target: ${typeof m.target === 'number' && m.target > 1000 ? (m.unit.includes('$') ? money(m.target) : num(m.target)) : m.target + (m.unit.includes('%') ? '%' : '')}</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill ${m.status === 'won-streak' ? 'green' : 'gold'}" style="width:${Math.min(100, m.progress_pct)}%;"></div>
              </div>
            </div>
            <p style="font-size:0.82rem; color:var(--text-muted); margin-top:8px;">${m.rules}</p>
          </div>
          <div class="mg-reward">🏆 Reward: ${m.reward}</div>
        </div>
      `).join('');
    }
  }

  // Navigation tab wiring
  function setupTabListeners() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-panel').forEach(panel => {
          panel.classList.remove('active');
        });
        const target = document.getElementById('tab-' + tabId);
        if (target) target.classList.add('active');
      });
    });
  }

  // Interactive What-If Simulator
  function setupSimulator() {
    const sliderCg = document.getElementById('slider-cg');
    const sliderTicket = document.getElementById('slider-ticket');
    const sliderCxl = document.getElementById('slider-cxl');

    const valCg = document.getElementById('val-slider-cg');
    const valTicket = document.getElementById('val-slider-ticket');
    const valCxl = document.getElementById('val-slider-cxl');

    const resArr = document.getElementById('sim-arr-res');
    const resProfit = document.getElementById('sim-profit-res');
    const resPool = document.getElementById('sim-pool-res');
    const resPerMember = document.getElementById('sim-per-member');

    function updateSim() {
      const extraCgPerWeek = Number(sliderCg.value); // agreements / tech / week
      const ticketBoost = Number(sliderTicket.value); // $ per ticket
      const cxlReductionPct = Number(sliderCxl.value); // % reduction in churn

      if (valCg) valCg.textContent = '+' + extraCgPerWeek + ' agreements / tech / wk';
      if (valTicket) valTicket.textContent = '+$' + ticketBoost + ' / ticket';
      if (valCxl) valCxl.textContent = '-' + cxlReductionPct + '% cancellations';

      // 12 active field techs * 52 weeks = 624 tech-weeks
      const annualAgreementsAdded = extraCgPerWeek * 12 * 50; 
      const arrAddedFromSales = annualAgreementsAdded * 195.00; // $16.25/mo * 12

      // Saved MRR from churn reduction: ~$11,000 lost in 2026 * reduction
      const arrSavedFromCxl = 15000 * (cxlReductionPct / 100);
      const totalArrImpact = arrAddedFromSales + arrSavedFromCxl;

      // Direct profit added from ticket boost across ~1,800 completed repair/service runs
      const annualRuns = 1800;
      const profitFromTickets = annualRuns * ticketBoost * 0.40; // 40% margin retained

      const totalProfitImpact = profitFromTickets + (totalArrImpact * 0.65);
      const teamPool = totalProfitImpact * 0.15; // 15% GGOB profit share pool
      const perPerson = teamPool / 21; // 21 staff members

      if (resArr) resArr.textContent = '+' + money(totalArrImpact) + ' / yr';
      if (resProfit) resProfit.textContent = '+' + money(totalProfitImpact) + ' / yr';
      if (resPool) resPool.textContent = '+' + money(teamPool) + ' / yr';
      if (resPerMember) resPerMember.textContent = '+' + money(perPerson) + ' / person';
    }

    if (sliderCg && sliderTicket && sliderCxl) {
      sliderCg.addEventListener('input', updateSim);
      sliderTicket.addEventListener('input', updateSim);
      sliderCxl.addEventListener('input', updateSim);
      updateSim();
    }
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
