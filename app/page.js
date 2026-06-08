'use client';

import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const LOCAL_KEY = 'ajot_trips_v2';

function toDatetimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fi-FI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fi-FI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function getTripMonth(trip) {
  const date = new Date(trip.ended_at || trip.started_at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 7);
}

function formatEuro(value) {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value);
}

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('live');
  const [description, setDescription] = useState('');
  const [route, setRoute] = useState('');
  const [tripType, setTripType] = useState('työajo');
  const [startOdo, setStartOdo] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [manualStartAt, setManualStartAt] = useState(toDatetimeLocal());
  const [manualEndAt, setManualEndAt] = useState(toDatetimeLocal());
  const [error, setError] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reimbursementRate, setReimbursementRate] = useState('');

  const activeTrip = trips.find((trip) => trip.status === 'active');

  async function loadTrips() {
    setLoading(true);
    setError('');

    if (isSupabaseConfigured) {
      const { data, error: dbError } = await supabase
        .from('trips')
        .select('*')
        .order('started_at', { ascending: false });

      if (dbError) setError(dbError.message);
      else setTrips(data || []);
    } else {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      setTrips(saved);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadTrips();
  }, []);

  function saveLocal(nextTrips) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(nextTrips));
    setTrips(nextTrips);
  }

  function resetForm() {
    setDescription('');
    setRoute('');
    setStartOdo('');
    setEndOdo('');
    setManualStartAt(toDatetimeLocal());
    setManualEndAt(toDatetimeLocal());
  }

  async function insertTrip(newTrip) {
    if (isSupabaseConfigured) {
      const { error: dbError } = await supabase.from('trips').insert(newTrip);
      if (dbError) return setError(dbError.message);
      await loadTrips();
    } else {
      saveLocal([{ ...newTrip, id: createLocalId(), created_at: new Date().toISOString() }, ...trips]);
    }
    resetForm();
  }

  async function startTrip(event) {
    event.preventDefault();
    setError('');

    const odo = Number(startOdo);
    if (!description.trim()) return setError('Lisää ajon selitys.');
    if (!Number.isInteger(odo) || odo <= 0) return setError('Syötä lähtökilometrit numerona.');
    if (activeTrip) return setError('Päätä nykyinen ajo ennen uuden aloittamista.');

    await insertTrip({
      description: description.trim(),
      route: route.trim(),
      trip_type: tripType,
      start_odometer: odo,
      status: 'active',
      started_at: new Date().toISOString()
    });
  }

  async function addManualTrip(event) {
    event.preventDefault();
    setError('');

    const start = Number(startOdo);
    const end = Number(endOdo);
    const startedAt = new Date(manualStartAt);
    const endedAt = new Date(manualEndAt);

    if (!description.trim()) return setError('Lisää ajon selitys.');
    if (!Number.isInteger(start) || start <= 0) return setError('Syötä alkukilometrit numerona.');
    if (!Number.isInteger(end) || end <= start) return setError('Loppukilometrien pitää olla suuremmat kuin alkukilometrit.');
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) return setError('Tarkista päivämäärät.');
    if (endedAt < startedAt) return setError('Loppupäivämäärä ei voi olla ennen alkupäivämäärää.');

    await insertTrip({
      description: description.trim(),
      route: route.trim(),
      trip_type: tripType,
      start_odometer: start,
      end_odometer: end,
      distance: end - start,
      status: 'done',
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString()
    });
  }

  async function finishTrip(event) {
    event.preventDefault();
    setError('');

    const odo = Number(endOdo);
    if (!activeTrip) return;
    if (!Number.isInteger(odo) || odo <= activeTrip.start_odometer) {
      return setError('Loppulukeman pitää olla suurempi kuin lähtölukema.');
    }

    const updates = {
      end_odometer: odo,
      distance: odo - activeTrip.start_odometer,
      status: 'done',
      ended_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      const { error: dbError } = await supabase
        .from('trips')
        .update(updates)
        .eq('id', activeTrip.id);
      if (dbError) return setError(dbError.message);
      await loadTrips();
    } else {
      saveLocal(trips.map((trip) => trip.id === activeTrip.id ? { ...trip, ...updates } : trip));
    }

    setEndOdo('');
  }

  async function cancelActiveTrip() {
    if (!activeTrip) return;
    setError('');

    if (isSupabaseConfigured) {
      const { error: dbError } = await supabase.from('trips').delete().eq('id', activeTrip.id);
      if (dbError) return setError(dbError.message);
      await loadTrips();
    } else {
      saveLocal(trips.filter((trip) => trip.id !== activeTrip.id));
    }
    setEndOdo('');
  }

  const doneTrips = trips.filter((trip) => trip.status === 'done');
  const monthKm = useMemo(() => {
    const now = new Date();
    return doneTrips
      .filter((trip) => {
        const date = new Date(trip.ended_at || trip.started_at);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, trip) => sum + Number(trip.distance || 0), 0);
  }, [doneTrips]);

  const monthlyReportTrips = useMemo(() => {
    return doneTrips
      .filter((trip) => getTripMonth(trip) === reportMonth)
      .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  }, [doneTrips, reportMonth]);

  const reportKm = useMemo(() => {
    return monthlyReportTrips.reduce((sum, trip) => sum + Number(trip.distance || 0), 0);
  }, [monthlyReportTrips]);

  const workKm = useMemo(() => {
    return monthlyReportTrips
      .filter((trip) => trip.trip_type === 'työajo')
      .reduce((sum, trip) => sum + Number(trip.distance || 0), 0);
  }, [monthlyReportTrips]);

  async function generatePdfReport() {
    setError('');

    if (monthlyReportTrips.length === 0) {
      return setError('Valitulla kuukaudella ei ole tallennettuja ajoja.');
    }

    const rate = Number(String(reimbursementRate).replace(',', '.')) || 0;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const monthLabel = new Intl.DateTimeFormat('fi-FI', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(`${reportMonth}-01T12:00:00`));

    let y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('AJOT', 14, y);

    y += 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Ajopäiväkirja ${monthLabel}`, 14, y);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Kilometrit yhteensä: ${reportKm} km`, 14, y);
    y += 6;
    doc.text(`Työajot: ${workKm} km`, 14, y);
    y += 6;
    doc.text(`Ajoja: ${monthlyReportTrips.length} kpl`, 14, y);

    if (rate > 0) {
      y += 6;
      doc.text(`Korvaus: ${formatEuro(workKm * rate)} (${rate.toFixed(2).replace('.', ',')} €/km)`, 14, y);
    }

    y += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Pvm', 14, y);
    doc.text('Reitti / selitys', 34, y);
    doc.text('Alku', 125, y);
    doc.text('Loppu', 145, y);
    doc.text('Km', 168, y);
    doc.text('Tyyppi', 181, y);
    y += 3;
    doc.line(14, y, 196, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    monthlyReportTrips.forEach((trip) => {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }

      const routeText = trip.route ? `${trip.route} - ${trip.description}` : trip.description;
      const wrappedRoute = doc.splitTextToSize(routeText, 86);
      const rowHeight = Math.max(8, wrappedRoute.length * 4 + 2);

      doc.text(formatShortDate(trip.started_at), 14, y);
      doc.text(wrappedRoute, 34, y);
      doc.text(String(trip.start_odometer || ''), 125, y);
      doc.text(String(trip.end_odometer || ''), 145, y);
      doc.text(String(trip.distance || 0), 168, y);
      doc.text(String(trip.trip_type || ''), 181, y);
      y += rowHeight;
    });

    y += 4;
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Yhteensä ${reportKm} km`, 14, y);
    if (rate > 0) {
      y += 6;
      doc.text(`Työajojen kulukorvaus ${formatEuro(workKm * rate)}`, 14, y);
    }

    doc.save(`ajot-${reportMonth}.pdf`);
  }


  return (
    <main className="container">
      <header className="header">
        <div className="logo">
          <h1>Ajot</h1>
          <span>Kevyt ajopäiväkirja kännykkään</span>
        </div>
        <div className="pill">{activeTrip ? 'Ajo käynnissä' : 'Valmis'}</div>
      </header>

      {!isSupabaseConfigured && (
        <div className="notice">
          Supabase ei ole vielä kytketty. Appi toimii nyt paikallisesti selaimen muistissa.
        </div>
      )}

      {error && <div className="notice">{error}</div>}

      {activeTrip ? (
        <section className="card">
          <h2>Päätä ajo</h2>
          <div className="meta">
            {activeTrip.description}<br />
            {activeTrip.route ? `${activeTrip.route} · ` : ''}{activeTrip.trip_type}<br />
            Lähtö: {activeTrip.start_odometer} km<br />
            Aloitettu: {formatDate(activeTrip.started_at)}
          </div>

          <form onSubmit={finishTrip}>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Loppumittarilukema</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={endOdo}
                onChange={(event) => setEndOdo(event.target.value)}
                placeholder="esim. 182518"
              />
            </div>

            {Number(endOdo) > activeTrip.start_odometer && (
              <>
                <div className="meta">Ajetut kilometrit</div>
                <div className="bigNumber">{Number(endOdo) - activeTrip.start_odometer} km</div>
              </>
            )}

            <button className="primary" type="submit">Päätä ajo</button>
            <div className="buttonRow">
              <button className="secondary" type="button" onClick={() => setEndOdo('')}>Tyhjennä</button>
              <button className="danger" type="button" onClick={cancelActiveTrip}>Poista ajo</button>
            </div>
          </form>
        </section>
      ) : (
        <section className="card">
          <div className="tabs">
            <button className={mode === 'live' ? 'tab active' : 'tab'} type="button" onClick={() => setMode('live')}>Aloita nyt</button>
            <button className={mode === 'manual' ? 'tab active' : 'tab'} type="button" onClick={() => setMode('manual')}>Lisää jälkikäteen</button>
          </div>

          <h2>{mode === 'live' ? 'Aloita ajo' : 'Lisää ajo jälkikäteen'}</h2>
          <form onSubmit={mode === 'live' ? startTrip : addManualTrip}>
            {mode === 'manual' && (
              <>
                <div className="field">
                  <label>Alkupäivä ja aika</label>
                  <input
                    type="datetime-local"
                    value={manualStartAt}
                    onChange={(event) => setManualStartAt(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Loppupäivä ja aika</label>
                  <input
                    type="datetime-local"
                    value={manualEndAt}
                    onChange={(event) => setManualEndAt(event.target.value)}
                  />
                </div>
              </>
            )}
            <div className="field">
              <label>{mode === 'live' ? 'Lähtömittarilukema' : 'Alkukilometrit'}</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={startOdo}
                onChange={(event) => setStartOdo(event.target.value)}
                placeholder="esim. 182450"
              />
            </div>
            {mode === 'manual' && (
              <div className="field">
                <label>Loppukilometrit</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={endOdo}
                  onChange={(event) => setEndOdo(event.target.value)}
                  placeholder="esim. 182518"
                />
              </div>
            )}
            {mode === 'manual' && Number(endOdo) > Number(startOdo) && (
              <>
                <div className="meta">Ajetut kilometrit</div>
                <div className="bigNumber">{Number(endOdo) - Number(startOdo)} km</div>
              </>
            )}
            <div className="field">
              <label>Ajon selitys</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="esim. Asiakaskäynti, tapahtuma, tavaran nouto"
              />
            </div>
            <div className="field">
              <label>Reitti</label>
              <input
                value={route}
                onChange={(event) => setRoute(event.target.value)}
                placeholder="esim. Vantaa – Helsinki – Vantaa"
              />
            </div>
            <div className="field">
              <label>Ajon tyyppi</label>
              <select value={tripType} onChange={(event) => setTripType(event.target.value)}>
                <option value="työajo">Työajo</option>
                <option value="yksityinen">Yksityinen</option>
                <option value="muu">Muu</option>
              </select>
            </div>
            <button className="primary" type="submit">{mode === 'live' ? 'Aloita ajo' : 'Tallenna ajo'}</button>
          </form>
        </section>
      )}

      <section className="card dashboardCard">
        <div className="gauge">
          <div className="gaugeLabel">Tämän kuun ajot</div>
          <div className="gaugeNumber">{monthKm}</div>
          <div className="gaugeUnit">km</div>
        </div>
        <div className="statsGrid">
          <div>
            <span>Työajot</span>
            <strong>{doneTrips.filter((trip) => trip.trip_type === 'työajo' && getTripMonth(trip) === new Date().toISOString().slice(0, 7)).reduce((sum, trip) => sum + Number(trip.distance || 0), 0)} km</strong>
          </div>
          <div>
            <span>Ajoja</span>
            <strong>{doneTrips.filter((trip) => getTripMonth(trip) === new Date().toISOString().slice(0, 7)).length}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>PDF-raportti</h2>
        <div className="field">
          <label>Kuukausi</label>
          <input
            type="month"
            value={reportMonth}
            onChange={(event) => setReportMonth(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Kulukorvaus €/km, valinnainen</label>
          <input
            inputMode="decimal"
            value={reimbursementRate}
            onChange={(event) => setReimbursementRate(event.target.value)}
            placeholder="esim. 0,57"
          />
        </div>
        <div className="reportSummary">
          <div>
            <span>Ajot</span>
            <strong>{monthlyReportTrips.length}</strong>
          </div>
          <div>
            <span>Yhteensä</span>
            <strong>{reportKm} km</strong>
          </div>
          <div>
            <span>Työajot</span>
            <strong>{workKm} km</strong>
          </div>
        </div>
        <button className="primary" type="button" onClick={generatePdfReport}>Luo PDF</button>
      </section>

      <section className="card">
        <h2>Historia</h2>
        {loading ? (
          <div className="meta">Ladataan ajoja...</div>
        ) : doneTrips.length === 0 ? (
          <div className="meta">Ei tallennettuja ajoja vielä.</div>
        ) : (
          <div className="tripList">
            {doneTrips.map((trip) => (
              <div className="tripItem" key={trip.id}>
                <div className="tripTop">
                  <div className="tripTitle">{trip.description}</div>
                  <div className="tripKm">{trip.distance} km</div>
                </div>
                <div className="meta">
                  {trip.route ? `${trip.route} · ` : ''}{trip.trip_type}<br />
                  {trip.start_odometer} → {trip.end_odometer} km<br />
                  {formatDate(trip.started_at)} – {formatDate(trip.ended_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="footerText">Supabase + Vercel valmis · PWA kotinäytölle</div>
    </main>
  );
}
