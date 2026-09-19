import React from 'react';

export default function FluvialMapLegend({ mapTheme = 'dark' }) {
  return (
    <div className={`fluvial-map-legend fluvial-map-legend--${mapTheme}`} aria-label="Legenda de navegação">
      <p className="fluvial-map-legend__title">Legenda</p>
      <ul className="fluvial-map-legend__list">
        <li>
          <span className="fluvial-map-legend__icon fluvial-map-legend__icon--vessel" aria-hidden="true" />
          Embarcação
        </li>
        <li>
          <span className="fluvial-map-legend__icon fluvial-map-legend__icon--route" aria-hidden="true" />
          Corredor Solimões
        </li>
        <li>
          <span className="fluvial-map-legend__icon fluvial-map-legend__icon--active" aria-hidden="true" />
          Com vínculo ativo
        </li>
      </ul>
    </div>
  );
}
