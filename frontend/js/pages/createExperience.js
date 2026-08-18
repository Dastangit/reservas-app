import api from '../api.js';
import auth from '../auth.js';

const CreateExperiencePage = {
  editId: null,
  images: [],

  async render() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como organizador.</p></div>';
    }

    this.editId = this._params?.id || null;
    let existing = null;

    if (this.editId) {
      try {
        const res = await api.get(`/organizer/experiences`);
        existing = (res.data?.experiences || []).find((e) => e._id === this.editId);
      } catch (error) {
        return '<div class="container"><p class="error">No se pudo cargar la excursión</p></div>';
      }
      if (!existing) {
        return '<div class="container"><p class="error">Excursión no encontrada</p></div>';
      }
      this.images = existing.images || [];
    }

    return `
      <div class="publish-property-page">
        <div class="container">
          <h1>${this.editId ? 'Editar excursión' : 'Nueva excursión'}</h1>

          <form id="experience-form">
            <div class="form-section">
              <h2>Información básica</h2>

              <div class="form-group">
                <label>Título</label>
                <input type="text" id="exp-title" value="${existing?.title || ''}" required>
              </div>

              <div class="form-group">
                <label>Descripción</label>
                <textarea id="exp-description" rows="4" required>${existing?.description || ''}</textarea>
              </div>

              <div class="form-group">
                <label>Categoría</label>
                <input type="text" id="exp-category" value="${existing?.category || ''}" placeholder="ej: tour, senderismo, gastronomía">
              </div>

              <div class="form-group">
                <label>Ciudad</label>
                <input type="text" id="exp-city" value="${existing?.location?.city || ''}" required>
              </div>

              <div class="form-group">
                <label>Dirección / punto de encuentro (opcional, solo lo ve el admin hasta aprobar la reserva)</label>
                <input type="text" id="exp-address" value="${existing?.location?.address || ''}">
              </div>

              <div class="form-group">
                <label>Fecha y hora</label>
                <input type="datetime-local" id="exp-date" value="${existing?.date ? new Date(existing.date).toISOString().slice(0, 16) : ''}" required>
              </div>

              <div class="form-group">
                <label>Duración (horas)</label>
                <input type="number" id="exp-duration" min="0" value="${existing?.duration_hours || ''}">
              </div>

              <div class="form-group">
                <label>Cupos máximos</label>
                <input type="number" id="exp-max-participants" min="1" value="${existing?.max_participants || ''}" required>
              </div>
            </div>

            <div class="form-section">
              <h2>Precios</h2>
              <p style="color:var(--text-light);font-size:0.9rem;">Define el precio por cupo según a quién le vendes -- podés agregar varias combinaciones.</p>

              <div id="pricing-rows">
                ${(existing?.pricing?.length ? existing.pricing : [{ audience: 'tourist', currency: 'USD', amount: '' }]).map((p) => this.pricingRowHtml(p)).join('')}
              </div>
              <button type="button" id="add-pricing-btn" class="btn btn-outline btn-sm">+ Agregar precio</button>
            </div>

            <div class="form-section">
              <h2>Mezcla de audiencias</h2>
              <label style="display:flex;align-items:flex-start;gap:8px;">
                <input type="checkbox" id="exp-mixed-audience" ${existing?.allows_mixed_audience ? 'checked' : ''} style="margin-top:4px;">
                <span>
                  Esta excursión admite reservas mixtas de residentes en Cuba y turistas juntos.
                  <br><strong style="color:var(--danger, #c0392b);">Solo marca esta opción si tienes el permiso legal vigente del gobierno cubano para hacerlo.</strong>
                  El admin revisa esto al aprobar la excursión.
                </span>
              </label>
            </div>

            <div class="form-section">
              <h2>Incluye</h2>
              <div id="includes-rows">
                ${(existing?.includes?.length ? existing.includes : ['']).map((v) => `
                  <div class="form-group list-row"><input type="text" class="includes-input" value="${v}" placeholder="ej: transporte, almuerzo"></div>
                `).join('')}
              </div>
              <button type="button" id="add-includes-btn" class="btn btn-outline btn-sm">+ Agregar</button>
            </div>

            <div class="form-section">
              <h2>Requisitos</h2>
              <div id="requirements-rows">
                ${(existing?.requirements?.length ? existing.requirements : ['']).map((v) => `
                  <div class="form-group list-row"><input type="text" class="requirements-input" value="${v}" placeholder="ej: buen estado físico"></div>
                `).join('')}
              </div>
              <button type="button" id="add-requirements-btn" class="btn btn-outline btn-sm">+ Agregar</button>
            </div>

            <div class="form-section">
              <h2>Política de cancelación (opcional)</h2>
              <textarea id="exp-cancellation-policy" rows="2">${existing?.cancellation_policy || ''}</textarea>
            </div>

            <div class="form-section">
              <h2>Fotos</h2>
              <input type="file" id="exp-image-upload" accept="image/*" multiple>
              <div id="exp-images-preview" class="images-preview"></div>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary btn-block">${this.editId ? 'Guardar cambios' : 'Enviar para aprobación'}</button>
          </form>
        </div>
      </div>
    `;
  },

  pricingRowHtml(p = {}) {
    return `
      <div class="form-group pricing-row" style="display:flex;gap:10px;align-items:end;">
        <div style="flex:1;">
          <label>Audiencia</label>
          <select class="pricing-audience">
            <option value="tourist" ${p.audience === 'tourist' ? 'selected' : ''}>Turista</option>
            <option value="local" ${p.audience === 'local' ? 'selected' : ''}>Residente en Cuba</option>
          </select>
        </div>
        <div style="flex:1;">
          <label>Moneda</label>
          <select class="pricing-currency">
            <option value="USD" ${p.currency === 'USD' ? 'selected' : ''}>USD</option>
            <option value="USDT" ${p.currency === 'USDT' ? 'selected' : ''}>USDT</option>
            <option value="CUP" ${p.currency === 'CUP' ? 'selected' : ''}>CUP</option>
          </select>
        </div>
        <div style="flex:1;">
          <label>Precio por cupo</label>
          <input type="number" class="pricing-amount" min="0" step="0.01" value="${p.amount ?? ''}" required>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-pricing-row">X</button>
      </div>
    `;
  },

  init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    this.renderImagePreview();

    document.getElementById('add-pricing-btn')?.addEventListener('click', () => {
      document.getElementById('pricing-rows').insertAdjacentHTML('beforeend', this.pricingRowHtml());
      this.bindRemoveButtons();
    });
    document.getElementById('add-includes-btn')?.addEventListener('click', () => {
      document.getElementById('includes-rows').insertAdjacentHTML('beforeend', '<div class="form-group list-row"><input type="text" class="includes-input"></div>');
    });
    document.getElementById('add-requirements-btn')?.addEventListener('click', () => {
      document.getElementById('requirements-rows').insertAdjacentHTML('beforeend', '<div class="form-group list-row"><input type="text" class="requirements-input"></div>');
    });
    this.bindRemoveButtons();

    document.getElementById('exp-image-upload')?.addEventListener('change', (e) => this.handleImageUpload(e));

    document.getElementById('experience-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  },

  bindRemoveButtons() {
    document.querySelectorAll('.remove-pricing-row').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => btn.closest('.pricing-row').remove());
    });
  },

  renderImagePreview() {
    const preview = document.getElementById('exp-images-preview');
    if (!preview) return;
    preview.innerHTML = this.images.map((img, i) => `
      <div class="image-preview-item">
        <img src="${img.url}" alt="">
        <button type="button" class="remove-image-btn" data-index="${i}">X</button>
      </div>
    `).join('');
    preview.querySelectorAll('.remove-image-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.images.splice(Number(btn.dataset.index), 1);
        this.renderImagePreview();
      });
    });
  },

  async handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const response = await api.uploadFile('/uploads/image', file);
        this.images.push({ url: response.data.url, public_id: response.data.public_id, order: this.images.length, is_primary: this.images.length === 0 });
      } catch (error) {
        alert('Error subiendo imagen: ' + error.message);
      }
    }
    this.renderImagePreview();
  },

  async handleSubmit() {
    const errorEl = document.getElementById('error-message');

    const pricing = Array.from(document.querySelectorAll('.pricing-row')).map((row) => ({
      audience: row.querySelector('.pricing-audience').value,
      currency: row.querySelector('.pricing-currency').value,
      amount: parseFloat(row.querySelector('.pricing-amount').value),
    }));

    if (pricing.length === 0 || pricing.some((p) => Number.isNaN(p.amount))) {
      errorEl.textContent = 'Revisa los precios ingresados';
      errorEl.style.display = 'block';
      return;
    }

    const includes = Array.from(document.querySelectorAll('.includes-input')).map((i) => i.value.trim()).filter(Boolean);
    const requirements = Array.from(document.querySelectorAll('.requirements-input')).map((i) => i.value.trim()).filter(Boolean);

    const payload = {
      title: document.getElementById('exp-title').value,
      description: document.getElementById('exp-description').value,
      category: document.getElementById('exp-category').value,
      location: {
        city: document.getElementById('exp-city').value,
        address: document.getElementById('exp-address').value,
      },
      date: document.getElementById('exp-date').value,
      duration_hours: Number(document.getElementById('exp-duration').value) || undefined,
      max_participants: Number(document.getElementById('exp-max-participants').value),
      pricing,
      allows_mixed_audience: document.getElementById('exp-mixed-audience').checked,
      includes,
      requirements,
      cancellation_policy: document.getElementById('exp-cancellation-policy').value,
      images: this.images,
    };

    try {
      if (this.editId) {
        await api.put(`/organizer/experiences/${this.editId}`, payload);
        window.location.href = '/organizer/experiences';
      } else {
        const response = await api.post('/organizer/experiences', payload);
        alert('Excursión enviada para aprobación del admin.');
        window.location.href = '/organizer/experiences';
      }
    } catch (error) {
      errorEl.textContent = error.message || 'No se pudo guardar la excursión';
      errorEl.style.display = 'block';
    }
  },
};

export default CreateExperiencePage;
