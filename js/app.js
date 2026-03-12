import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.APP_CONFIG || {};
const TABLE_NAME = config.TABLE_NAME || 'reservas_eventos';
let supabase = null;
let allBookings = [];
let activeFilter = 'todos';

const els = {
  quickDate: document.getElementById('quickDate'),
  btnQuickCheck: document.getElementById('btnQuickCheck'),
  quickStatus: document.getElementById('quickStatus'),
  form: document.getElementById('bookingForm'),
  formAlert: document.getElementById('formAlert'),
  editingId: document.getElementById('editingId'),
  fechaEvento: document.getElementById('fechaEvento'),
  tipoEvento: document.getElementById('tipoEvento'),
  clienteNombre: document.getElementById('clienteNombre'),
  clienteTelefono: document.getElementById('clienteTelefono'),
  anticipo: document.getElementById('anticipo'),
  notas: document.getElementById('notas'),
  btnCheckDate: document.getElementById('btnCheckDate'),
  btnSaveBooking: document.getElementById('btnSaveBooking'),
  btnClearCancelled: document.getElementById('btnClearCancelled'),
  btnCancelEdit: document.getElementById('btnCancelEdit'),
  searchInput: document.getElementById('searchInput'),
  cardsContainer: document.getElementById('cardsContainer'),
  detailContent: document.getElementById('detailContent'),
  filterChips: [...document.querySelectorAll('.filter-chip')]
};

const detailModalEl = document.getElementById('detailModal');
const detailModal = detailModalEl ? new bootstrap.Modal(detailModalEl) : null;

function getTable() {
  return TABLE_NAME;
}

function initSupabase() {
  if (
    !config.SUPABASE_URL ||
    !config.SUPABASE_ANON_KEY ||
    config.SUPABASE_URL.includes('PEGA_AQUI')
  ) {
    els.cardsContainer.innerHTML = `<div class="empty-card">Configurá primero tu <strong>SUPABASE_URL</strong>, tu <strong>SUPABASE_ANON_KEY</strong> y la tabla <strong>${sanitize(TABLE_NAME)}</strong> en <code>js/config.js</code>.</div>`;
    setQuickStatus(
      'neutral',
      `Falta configurar Supabase en <strong>js/config.js</strong>. Tabla actual: <strong>${sanitize(TABLE_NAME)}</strong>.`
    );
    return false;
  }

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  return true;
}

function sanitize(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatGuaranies(value) {
  const digits = onlyDigits(value);
  if (!digits) return '-';
  return Number(digits).toLocaleString('es-PY');
}

function formatGuaraniesInput(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  return Number(digits).toLocaleString('es-PY');
}

function normalizeAnticipoForSave(value) {
  return formatGuaraniesInput(value);
}

function showAlert(target, message, type = 'info') {
  target.className = `alert alert-${type} mb-0`;
  target.innerHTML = message;
  target.classList.remove('d-none');
}

function hideAlert(target) {
  target.classList.add('d-none');
  target.innerHTML = '';
}

function setQuickStatus(kind, html) {
  els.quickStatus.className = `status-panel ${kind}`;
  els.quickStatus.innerHTML = html;
}

function statusClass(status) {
  return `status-${status || 'reservado'}`;
}

function statusText(status) {
  if (status === 'finalizado') return 'Finalizado';
  if (status === 'cancelado') return 'Cancelado';
  return 'Reservado';
}

async function checkDate(dateString, excludeId = null) {
  if (!supabase || !dateString) return { active: null, sameDay: [] };

  let query = supabase
    .from(getTable())
    .select('id, fecha_evento, cliente_nombre, cliente_telefono, tipo_evento, notas, anticipo, estado, created_at')
    .eq('fecha_evento', dateString)
    .order('created_at', { ascending: false });

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw error;

  const sameDay = data || [];
  const active =
    sameDay.find(item => item.estado === 'reservado' || item.estado === 'finalizado') || null;

  return { active, sameDay };
}

function buildDateMessage(result, dateString) {
  const active = result.active;

  if (active) {
    return {
      kind: 'reserved',
      html: `
        <div>
          <div class="fw-bold mb-2">Esta fecha ya está ocupada.</div>
          <div>Está ${active.estado === 'finalizado' ? 'finalizada' : 'reservada'} por <strong>${sanitize(active.cliente_nombre)}</strong>.</div>
          <div class="mt-1">Evento: <strong>${sanitize(active.tipo_evento)}</strong></div>
          <div class="small mt-2 opacity-75">Fecha: ${formatDate(active.fecha_evento)}</div>
        </div>
      `
    };
  }

  const cancelled = result.sameDay.find(item => item.estado === 'cancelado');

  if (cancelled) {
    return {
      kind: 'cancelado',
      html: `
        <div>
          <div class="fw-bold mb-2">Fecha disponible nuevamente</div>
          <div>Esta fecha tuvo una reserva cancelada, así que ahora <strong>puede volver a usarse</strong>.</div>
          <div class="small mt-2 opacity-75">Fecha: ${formatDate(dateString)}</div>
        </div>
      `
    };
  }

  return {
    kind: 'available',
    html: `
      <div>
        <div class="fw-bold mb-2">Fecha disponible</div>
        <div>La fecha <strong>${formatDate(dateString)}</strong> está libre para una nueva reserva.</div>
      </div>
    `
  };
}

async function handleDateCheck(dateString, showOnForm = false, excludeId = null) {
  if (!dateString) {
    const msg = 'Primero elegí una fecha.';
    setQuickStatus('neutral', msg);
    if (showOnForm) showAlert(els.formAlert, msg, 'warning');
    return null;
  }

  try {
    hideAlert(els.formAlert);

    const result = await checkDate(dateString, excludeId);
    const message = buildDateMessage(result, dateString);

    setQuickStatus(message.kind, message.html);

    if (showOnForm) {
      if (result.active) {
        showAlert(
          els.formAlert,
          `La fecha <strong>${formatDate(dateString)}</strong> ya está ${result.active.estado === 'finalizado' ? 'finalizada' : 'reservada'} por <strong>${sanitize(result.active.cliente_nombre)}</strong>.`,
          'danger'
        );
      } else if (result.sameDay.some(item => item.estado === 'cancelado')) {
        showAlert(
          els.formAlert,
          `La fecha <strong>${formatDate(dateString)}</strong> quedó libre porque la reserva anterior fue cancelada. Ya podés volver a reservarla.`,
          'warning'
        );
      } else {
        showAlert(
          els.formAlert,
          `La fecha <strong>${formatDate(dateString)}</strong> está disponible.`,
          'success'
        );
      }
    }

    return result;
  } catch (error) {
    const msg = `No se pudo verificar la fecha: ${sanitize(error.message)}`;
    setQuickStatus('neutral', msg);
    if (showOnForm) showAlert(els.formAlert, msg, 'danger');
    return null;
  }
}

function renderCards(items) {
  if (!items.length) {
    els.cardsContainer.innerHTML =
      '<div class="empty-card">No hay reservas para mostrar con ese filtro.</div>';
    return;
  }

  els.cardsContainer.innerHTML = items
    .map(
      item => `
      <article class="booking-card">
        <div class="booking-top">
          <div class="booking-date">
            <div class="date-badge"><i class="bi bi-calendar2-heart"></i></div>
            <div>
              <h3>${sanitize(item.cliente_nombre)}</h3>
              <div class="meta-line">${formatDate(item.fecha_evento)} • ${sanitize(item.tipo_evento)}</div>
            </div>
          </div>
          <span class="status-badge ${statusClass(item.estado)}">${statusText(item.estado)}</span>
        </div>

        <div class="card-detail-grid">
          <div class="detail-box">
            <small>Teléfono</small>
            <strong>${sanitize(item.cliente_telefono || '-')}</strong>
          </div>
          <div class="detail-box">
            <small>Seña / detalle</small>
            <strong>${sanitize(item.anticipo ? formatGuaranies(item.anticipo) : '-')}</strong>
          </div>
        </div>

        <div class="card-notes">${sanitize(item.notas || 'Sin notas cargadas.')}</div>

        <div class="card-actions">
          <button class="btn-card" data-action="detail" data-id="${item.id}"><i class="bi bi-eye me-2"></i>Detalle</button>
          <button class="btn-card" data-action="edit" data-id="${item.id}"><i class="bi bi-pencil-square me-2"></i>Editar</button>
          <button class="btn-card" data-action="finalizar" data-id="${item.id}"><i class="bi bi-check2-circle me-2"></i>Finalizar</button>
          <button class="btn-card" data-action="cancelar" data-id="${item.id}"><i class="bi bi-x-circle me-2"></i>Cancelar</button>
        </div>
      </article>
    `
    )
    .join('');
}

function applyFilters() {
  const term = (els.searchInput.value || '').trim().toLowerCase();
  let items = [...allBookings];

  if (activeFilter !== 'todos') {
    items = items.filter(item => item.estado === activeFilter);
  }

  if (term) {
    items = items.filter(
      item =>
        (item.cliente_nombre || '').toLowerCase().includes(term) ||
        (item.cliente_telefono || '').toLowerCase().includes(term) ||
        (item.tipo_evento || '').toLowerCase().includes(term) ||
        (item.notas || '').toLowerCase().includes(term)
    );
  }

  renderCards(items);
}

async function fetchBookings() {
  const { data, error } = await supabase
    .from(getTable())
    .select('*')
    .order('fecha_evento', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    els.cardsContainer.innerHTML = `<div class="empty-card text-danger">Error al cargar reservas: ${sanitize(error.message)}</div>`;
    return;
  }

  allBookings = data || [];
  applyFilters();
}

function resetForm() {
  els.form.reset();
  els.editingId.value = '';
  hideAlert(els.formAlert);
  els.btnSaveBooking.disabled = false;
  els.btnSaveBooking.innerHTML = '<i class="bi bi-floppy me-2"></i>Guardar reserva';
  setQuickStatus('neutral', 'Elegí una fecha para saber si está disponible, reservada, finalizada o cancelada.');
}

function fillForm(booking) {
  els.editingId.value = booking.id;
  els.fechaEvento.value = booking.fecha_evento || '';
  els.tipoEvento.value = booking.tipo_evento || '';
  els.clienteNombre.value = booking.cliente_nombre || '';
  els.clienteTelefono.value = booking.cliente_telefono || '';
  els.anticipo.value = booking.anticipo ? formatGuaraniesInput(booking.anticipo) : '';
  els.notas.value = booking.notas || '';
  els.btnSaveBooking.innerHTML = '<i class="bi bi-arrow-repeat me-2"></i>Actualizar reserva';

  document.getElementById('bookingForm').scrollIntoView({
  behavior: 'smooth',
  block: 'start'
});

  showAlert(
    els.formAlert,
    `Estás editando la reserva de <strong>${sanitize(booking.cliente_nombre)}</strong>.`,
    'warning'
  );
}

function showDetail(booking) {
  els.detailContent.innerHTML = `
    <div class="modal-detail-line"><strong>Cliente</strong><span>${sanitize(booking.cliente_nombre)}</span></div>
    <div class="modal-detail-line"><strong>Fecha</strong><span>${formatDate(booking.fecha_evento)}</span></div>
    <div class="modal-detail-line"><strong>Estado</strong><span>${statusText(booking.estado)}</span></div>
    <div class="modal-detail-line"><strong>Evento</strong><span>${sanitize(booking.tipo_evento)}</span></div>
    <div class="modal-detail-line"><strong>Teléfono</strong><span>${sanitize(booking.cliente_telefono || '-')}</span></div>
    <div class="modal-detail-line"><strong>Seña / detalle</strong><span>${sanitize(booking.anticipo ? formatGuaranies(booking.anticipo) : '-')}</span></div>
    <div class="modal-detail-line"><strong>Notas</strong><span>${sanitize(booking.notas || 'Sin notas')}</span></div>
  `;

  if (detailModal) detailModal.show();
}

async function saveBooking(event) {
  event.preventDefault();
  hideAlert(els.formAlert);

  const editingId = els.editingId.value ? Number(els.editingId.value) : null;

  const payload = {
    fecha_evento: els.fechaEvento.value,
    tipo_evento: els.tipoEvento.value,
    cliente_nombre: els.clienteNombre.value.trim(),
    cliente_telefono: els.clienteTelefono.value.trim(),
    anticipo: normalizeAnticipoForSave(els.anticipo.value),
    notas: els.notas.value.trim(),
    estado: 'reservado'
  };

  if (!payload.fecha_evento || !payload.tipo_evento || !payload.cliente_nombre) {
    showAlert(els.formAlert, 'Completá los campos obligatorios.', 'warning');
    return;
  }

  const result = await handleDateCheck(payload.fecha_evento, false, editingId);

  if (result?.active) {
    showAlert(
      els.formAlert,
      `No se puede guardar. La fecha <strong>${formatDate(payload.fecha_evento)}</strong> ya está ${result.active.estado === 'finalizado' ? 'finalizada' : 'reservada'} por <strong>${sanitize(result.active.cliente_nombre)}</strong>.`,
      'danger'
    );
    return;
  }

  els.btnSaveBooking.disabled = true;
  els.btnSaveBooking.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

  let response;

  if (editingId) {
    response = await supabase.from(getTable()).update(payload).eq('id', editingId);
  } else {
    response = await supabase.from(getTable()).insert([payload]);
  }

  els.btnSaveBooking.disabled = false;
  els.btnSaveBooking.innerHTML = editingId
    ? '<i class="bi bi-arrow-repeat me-2"></i>Actualizar reserva'
    : '<i class="bi bi-floppy me-2"></i>Guardar reserva';

  if (response.error) {
    const msg = sanitize(response.error.message || 'Error al guardar');

    if (
      (response.error.message || '').toLowerCase().includes('unique') ||
      (response.error.message || '').toLowerCase().includes('duplic')
    ) {
      showAlert(els.formAlert, 'No se guardó porque ya existe una fecha activa para ese día.', 'danger');
    } else {
      showAlert(els.formAlert, `No se pudo guardar: ${msg}`, 'danger');
    }
    return;
  }

  showAlert(
    els.formAlert,
    editingId ? 'Reserva actualizada correctamente.' : 'Reserva guardada correctamente.',
    'success'
  );

  resetForm();
  await fetchBookings();
}

async function updateStatus(id, newStatus) {
  const booking = allBookings.find(item => item.id === id);
  if (!booking) return;

  const confirmed = confirm(
    `¿Querés ${newStatus === 'finalizado' ? 'finalizar' : 'cancelar'} la fecha de ${booking.cliente_nombre} del ${formatDate(booking.fecha_evento)}?`
  );

  if (!confirmed) return;

  const { error } = await supabase.from(getTable()).update({ estado: newStatus }).eq('id', id);

  if (error) {
    alert(`No se pudo actualizar el estado: ${error.message}`);
    return;
  }

  if (newStatus === 'cancelado') {
    alert('Reserva cancelada. Esa fecha vuelve a quedar disponible para una nueva reserva.');
  } else {
    alert('Reserva finalizada correctamente.');
  }

  await fetchBookings();
}

async function clearCancelledBookings() {
  const cancelled = allBookings.filter(item => item.estado === 'cancelado');

  if (!cancelled.length) {
    alert('No hay reservas canceladas para limpiar.');
    return;
  }

  const confirmed = confirm(`Se eliminarán ${cancelled.length} reservas canceladas. ¿Querés continuar?`);
  if (!confirmed) return;

  els.btnClearCancelled.disabled = true;
  els.btnClearCancelled.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Limpiando...';

  const { error } = await supabase
    .from(getTable())
    .delete()
    .eq('estado', 'cancelado');

  els.btnClearCancelled.disabled = false;
  els.btnClearCancelled.innerHTML = '<i class="bi bi-trash3 me-2"></i>Limpiar cancelados';

  if (error) {
    alert(`No se pudieron eliminar los cancelados: ${error.message}`);
    return;
  }

  alert('Reservas canceladas eliminadas correctamente.');
  await fetchBookings();
}

async function handleCardAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const booking = allBookings.find(item => item.id === id);

  if (!booking) return;

  if (action === 'detail') {
    showDetail(booking);
    return;
  }

  if (action === 'edit') {
    fillForm(booking);
    return;
  }

  if (action === 'finalizar') {
    await updateStatus(id, 'finalizado');
    return;
  }

  if (action === 'cancelar') {
    await updateStatus(id, 'cancelado');
  }
}

function handleAnticipoInput(event) {
  const formatted = formatGuaraniesInput(event.target.value);
  event.target.value = formatted;

  try {
    event.target.setSelectionRange(event.target.value.length, event.target.value.length);
  } catch {}
}

function bindEvents() {
  els.btnQuickCheck.addEventListener('click', () => handleDateCheck(els.quickDate.value));
  els.btnCheckDate.addEventListener('click', () =>
    handleDateCheck(els.fechaEvento.value, true, els.editingId.value || null)
  );
  els.form.addEventListener('submit', saveBooking);
  els.btnCancelEdit.addEventListener('click', resetForm);
  els.searchInput.addEventListener('input', applyFilters);
  els.cardsContainer.addEventListener('click', handleCardAction);

  if (els.btnClearCancelled) {
    els.btnClearCancelled.addEventListener('click', clearCancelledBookings);
  }

  els.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      els.filterChips.forEach(btn => btn.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      applyFilters();
    });
  });

  els.fechaEvento.addEventListener('change', () => {
    if (els.fechaEvento.value) {
      handleDateCheck(els.fechaEvento.value, true, els.editingId.value || null);
    }
  });

  els.anticipo.addEventListener('input', handleAnticipoInput);
}

async function init() {
  const ok = initSupabase();
  bindEvents();
  if (!ok) return;
  await fetchBookings();
}

init();