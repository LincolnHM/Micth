// ─── Sección: Galería pública (Envíos + Clientes) ──────────────────────────────

const GALLERY_GRID_IDS = { envios: 'galeriaGridEnvios', clientes: 'galeriaGridClientes' };

async function renderGalleryGrid(categoria) {
  const container = document.getElementById(GALLERY_GRID_IDS[categoria]);
  if (!container) return;
  container.querySelectorAll('.gallery-admin-thumb').forEach(el => el.remove());
  let photos = [];
  try { photos = await CloudGallery.getAll(categoria); } catch (err) { console.error(err); }
  photos.forEach(p => {
    const thumb = document.createElement('div');
    thumb.className = 'gallery-admin-thumb';
    thumb.innerHTML = `
      <img src="${escapeAttr(p.image_url)}" alt="" loading="lazy">
      <button type="button" class="gallery-admin-thumb-remove" aria-label="Eliminar foto"
              data-id="${escapeAttr(String(p.id))}" data-path="${escapeAttr(p.image_path || '')}">×</button>
    `;
    container.appendChild(thumb);
  });
}

async function renderGallerySection() {
  await Promise.all([renderGalleryGrid('envios'), renderGalleryGrid('clientes')]);
}

async function handleGalleryUpload(file, categoria, zone) {
  if (zone) zone.style.opacity = '.5';
  try {
    await CloudGallery.upload(file, categoria);
    showToast('Foto subida ✓');
    await renderGalleryGrid(categoria);
  } catch (err) {
    console.error(err);
    showToast(err.message || 'No se pudo subir la foto.');
  } finally {
    if (zone) zone.style.opacity = '1';
  }
}

function wireGalleryUpload(categoria, zoneId, inputId) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  input.addEventListener('change', () => {
    if (input.files[0]) handleGalleryUpload(input.files[0], categoria, zone);
    input.value = '';
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleGalleryUpload(e.dataTransfer.files[0], categoria, zone);
  });
}

async function handleGalleryDeleteClick(e) {
  const btn = e.target.closest('.gallery-admin-thumb-remove');
  if (!btn) return;
  if (!confirm('¿Eliminar esta foto? Se quitará también de la página pública.')) return;
  btn.disabled = true;
  try {
    await CloudGallery.remove(btn.dataset.id, btn.dataset.path);
    btn.closest('.gallery-admin-thumb')?.remove();
    showToast('Foto eliminada ✓');
  } catch (err) {
    console.error(err);
    showToast('No se pudo eliminar la foto.');
    btn.disabled = false;
  }
}

function setupGalleryEvents() {
  const marker = document.getElementById('galeriaAddEnvios');
  if (marker && marker.dataset.ready !== '1') {
    marker.dataset.ready = '1';
    wireGalleryUpload('envios',   'galeriaAddEnvios',   'galeriaFileEnvios');
    wireGalleryUpload('clientes', 'galeriaAddClientes', 'galeriaFileClientes');
    document.getElementById('galeriaGridEnvios')?.addEventListener('click', handleGalleryDeleteClick);
    document.getElementById('galeriaGridClientes')?.addEventListener('click', handleGalleryDeleteClick);
  }
  renderGallerySection().catch(console.error);
}

async function refreshCampaignAdminUI() {
  const statusEl = document.getElementById('campaignStatusText');
  if (!statusEl || typeof SiteTheme === 'undefined') return;

  const updatedAtEl = document.getElementById('campaignUpdatedAt');
  const autoBtn = document.getElementById('autoCampaignBtn');
  const settings = await SiteTheme.getSettings();
  const activeCampaign = settings.campaign || 'default';
  const mode = settings.mode === 'auto' ? 'auto' : 'manual';
  const modeLabel = mode === 'auto' ? 'Automático' : 'Manual';
  statusEl.textContent = `${CAMPAIGN_LABELS[activeCampaign] || 'Diseño normal'} · ${modeLabel}`;

  const statusBox = document.querySelector('.campaign-status-box');
  if (statusBox) {
    statusBox.className = 'campaign-status-box campaign-' + activeCampaign;
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(statusBox, 
        { scale: 0.97, opacity: 0.85 }, 
        { scale: 1, opacity: 1, duration: 0.45, ease: 'power2.out' }
      );
    }
  }

  if (autoBtn) {
    autoBtn.classList.toggle('active', mode === 'auto');
    autoBtn.textContent = mode === 'auto' ? 'Modo automático activo' : 'Modo automático';
  }

  if (updatedAtEl) {
    if (settings.updatedAt) {
      const d = new Date(settings.updatedAt);
      updatedAtEl.textContent = `Última actualización: ${d.toLocaleString('es-PE')} · Campaña del día: ${CAMPAIGN_LABELS[activeCampaign] || 'Diseño normal'}`;
    } else {
      updatedAtEl.textContent = 'Última actualización: no registrada';
    }
  }

  document.querySelectorAll('.campaign-apply-btn').forEach(btn => {
    const isActive = btn.dataset.campaign === activeCampaign;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateAnnImgPreview(url) {
  const preview     = document.getElementById('annImgPreview');
  const placeholder = document.getElementById('annImgPlaceholder');
  const zone        = document.getElementById('annImgUploadZone');
  const actions     = document.getElementById('annImgUploadActions');
  if (url) {
    preview.src            = url;
    preview.style.display  = 'block';
    placeholder.style.display = 'none';
    zone.classList.add('has-image');
    actions.style.display = 'flex';
  } else {
    preview.src            = '';
    preview.style.display  = 'none';
    placeholder.style.display = 'flex';
    zone.classList.remove('has-image');
    actions.style.display = 'none';
  }
}

function handleAnnImageFile(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Selecciona una imagen válida (JPG, PNG o WebP).'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('La imagen supera los 5 MB.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('annImageUrl').value = e.target.result;
    updateAnnImgPreview(e.target.result);
  };
  reader.readAsDataURL(file);
}

async function refreshAnnouncementAdminUI() {
  const enabledEl = document.getElementById('annEnabled');
  if (!enabledEl || typeof SiteAnnouncement === 'undefined') return;

  const settings = await SiteAnnouncement.getSettings();
  enabledEl.checked = !!settings.enabled;
  document.getElementById('annImageUrl').value  = settings.imageUrl || '';
  updateAnnImgPreview(settings.imageUrl || '');
  document.getElementById('annEmoji').value     = settings.emoji || '';
  document.getElementById('annTitle').value     = settings.title || '';
  document.getElementById('annMessage').value   = settings.message || '';
  document.getElementById('annCtaText').value   = settings.ctaText || '';
  document.getElementById('annCtaAction').value = settings.ctaAction || 'none';

  const statusEl = document.getElementById('annStatusText');
  if (statusEl) {
    statusEl.textContent = settings.updatedAt
      ? `Última actualización: ${new Date(settings.updatedAt).toLocaleString('es-PE')}`
      : '';
  }
}

function setupAnnouncementEvents() {
  const btn = document.getElementById('annSaveBtn');
  if (!btn || btn.dataset.ready === '1') {
    refreshAnnouncementAdminUI().catch(console.error);
    return;
  }
  btn.dataset.ready = '1';

  // ── Subida de imagen del anuncio (mismo patrón que la imagen de producto) ──
  const imgZone   = document.getElementById('annImgUploadZone');
  const imgInput  = document.getElementById('annImgFileInput');
  const imgChange = document.getElementById('annImgChangeBtn');
  const imgRemove = document.getElementById('annImgRemoveBtn');

  imgZone?.addEventListener('click', () => imgInput?.click());
  imgZone?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') imgInput?.click(); });
  imgInput?.addEventListener('change', () => { if (imgInput.files[0]) handleAnnImageFile(imgInput.files[0]); });

  imgZone?.addEventListener('dragover', e => { e.preventDefault(); imgZone.classList.add('drag-over'); });
  imgZone?.addEventListener('dragleave', () => imgZone.classList.remove('drag-over'));
  imgZone?.addEventListener('drop', e => {
    e.preventDefault();
    imgZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleAnnImageFile(e.dataTransfer.files[0]);
  });

  imgChange?.addEventListener('click', e => { e.stopPropagation(); imgInput.click(); });
  imgRemove?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('annImageUrl').value = '';
    updateAnnImgPreview('');
    imgInput.value = '';
  });

  btn.addEventListener('click', async () => {
    if (typeof SiteAnnouncement === 'undefined') return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Guardando…';

    const input = {
      enabled:   document.getElementById('annEnabled').checked,
      imageUrl:  document.getElementById('annImageUrl').value,
      emoji:     document.getElementById('annEmoji').value,
      title:     document.getElementById('annTitle').value,
      message:   document.getElementById('annMessage').value,
      ctaText:   document.getElementById('annCtaText').value,
      ctaAction: document.getElementById('annCtaAction').value
    };

    try {
      const result = await SiteAnnouncement.save(input);
      await refreshAnnouncementAdminUI();
      if (result?.synced) showToast('Anuncio guardado ✓');
      else showToast('Anuncio guardado en este navegador ✓');
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar el anuncio. Inténtalo de nuevo.');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  refreshAnnouncementAdminUI().catch(console.error);
}

function setupCampaignEvents() {
  const wrap = document.getElementById('campaignButtonsGrid');
  if (!wrap || wrap.dataset.ready === '1') {
    refreshCampaignAdminUI().catch(console.error);
    return;
  }
  wrap.dataset.ready = '1';

  wrap.querySelectorAll('.campaign-apply-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const campaign = btn.dataset.campaign;
      if (!campaign || typeof SiteTheme === 'undefined') return;

      btn.disabled = true;
      const prev = btn.innerHTML;
      btn.innerHTML = '<strong>Aplicando...</strong><span>Actualizando la tienda</span>';

      if (typeof gsap !== 'undefined') {
        gsap.to(btn, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 });
      }

      if (window.burstCampaignDecor) {
        window.burstCampaignDecor(btn, campaign);
      }

      try {
        const result = await SiteTheme.setActiveCampaign(campaign);
        await refreshCampaignAdminUI();
        if (result?.synced) showToast(`Campaña activada: ${CAMPAIGN_LABELS[campaign]} ✓`);
        else showToast(`Campaña activada en este navegador: ${CAMPAIGN_LABELS[campaign]} ✓`);
      } catch (err) {
        console.error(err);
        showToast('No se pudo activar la campaña. Inténtalo de nuevo.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
  });

  document.getElementById('disableCampaignBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('disableCampaignBtn');
    if (!btn || typeof SiteTheme === 'undefined') return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Desactivando...';

    if (typeof gsap !== 'undefined') {
      gsap.to(btn, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 });
    }

    try {
      const result = await SiteTheme.setActiveCampaign('default');
      await refreshCampaignAdminUI();
      if (result?.synced) showToast('Campaña desactivada. Diseño normal restaurado ✓');
      else showToast('Diseño normal restaurado en este navegador ✓');
    } catch (err) {
      console.error(err);
      showToast('No se pudo desactivar la campaña.');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  document.getElementById('autoCampaignBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('autoCampaignBtn');
    if (!btn || typeof SiteTheme === 'undefined') return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Activando...';

    if (typeof gsap !== 'undefined') {
      gsap.to(btn, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 });
    }

    try {
      const result = await SiteTheme.setAutomaticMode();
      await refreshCampaignAdminUI();
      if (result?.synced) showToast('Modo automático activado ✓');
      else showToast('Modo automático activado en este navegador ✓');
    } catch (err) {
      console.error(err);
      showToast('No se pudo activar el modo automático.');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  refreshCampaignAdminUI().catch(console.error);
}
