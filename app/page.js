'use client';

import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const LOCAL_KEY = 'ajopaivakirja_trips_v1';

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

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [route, setRoute] = useState('');
  const [tripType, setTripType] = useState('työajo');
  const [startOdo, setStartOdo] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [error, setError] = useState('');

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

  async function startTrip(event) {
    event.preventDefault();
    setError('');

    const odo = Number(startOdo);
    if (!description.trim()) return setError('Lisää ajon selitys.');
    if (!Number.isInteger(odo) || odo <= 0) return setError('Syötä lähtökilometrit numerona.');
    if (activeTrip) return setError('Päätä nykyinen ajo ennen uuden aloittamista.');

    const newTrip = {
      description: description.trim(),
      route: route.trim(),
      trip_type: tripType,
      start_odometer: odo,
      status: 'active',
      started_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      const { error: dbError } = await supabase.from('trips').insert(newTrip);
      if (dbError) return setError(dbError.message);
      await loadTrips();
    } else {
      saveLocal([{ ...newTrip, id: createLocalId(), created_at: new Date().toISOString() }, ...trips]);
    }

    setDescription('');
    setRoute('');
    setStartOdo('');
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

  return (
    <main className="container">
      <header className="header">
        <div className="logo">
          <h1>Ajopäiväkirja</h1>
          <span>Oma kevyt kilometrikirjaus</span>
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
          <h2>Aloita ajo</h2>
          <form onSubmit={startTrip}>
            <div className="field">
              <label>Lähtömittarilukema</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={startOdo}
                onChange={(event) => setStartOdo(event.target.value)}
                placeholder="esim. 182450"
              />
            </div>
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
            <button className="primary" type="submit">Aloita ajo</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Tämän kuun ajot</h2>
        <div className="bigNumber">{monthKm} km</div>
        <div className="meta">Valmiiksi päätetyt ajot yhteensä</div>
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
