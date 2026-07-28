#!/usr/bin/env python3
import json, sys, os, math, datetime, re
try:
    import swisseph as swe
except Exception as exc:
    print(json.dumps({"success": False, "error": f"pyswisseph not available: {exc}"}))
    sys.exit(0)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EPHE = os.path.join(ROOT, 'ephe')
swe.set_ephe_path(EPHE)

SIGNS = {
    'Aries':0,'Taurus':30,'Gemini':60,'Cancer':90,'Leo':120,'Virgo':150,
    'Libra':180,'Scorpio':210,'Sagittarius':240,'Capricorn':270,'Aquarius':300,'Pisces':330
}

MONTHS = {
    'january':1,'jan':1,'janeiro':1,
    'february':2,'feb':2,'fevereiro':2,
    'march':3,'mar':3,'marco':3,'março':3,
    'april':4,'apr':4,'abril':4,
    'may':5,'maio':5,
    'june':6,'jun':6,'junho':6,
    'july':7,'jul':7,'julho':7,
    'august':8,'aug':8,'agosto':8,
    'september':9,'sep':9,'sept':9,'setembro':9,
    'october':10,'oct':10,'outubro':10,
    'november':11,'nov':11,'novembro':11,
    'december':12,'dec':12,'dezembro':12,
}

def parse_int_field(req, names, default=None, min_value=None, max_value=None):
    for name in names:
        if name in req and req.get(name) not in (None, ''):
            value = req.get(name)
            if isinstance(value, str):
                value = value.strip()
                if not value:
                    continue
            try:
                parsed = int(float(value))
            except Exception:
                raise ValueError(f'invalid {name}: {value!r}')
            if min_value is not None and parsed < min_value:
                raise ValueError(f'{name} must be >= {min_value}')
            if max_value is not None and parsed > max_value:
                raise ValueError(f'{name} must be <= {max_value}')
            return parsed
    if default is not None:
        return default
    raise ValueError(f'missing {names[0]}')

def parse_float_field(req, names, default=0.0):
    for name in names:
        if name in req and req.get(name) not in (None, ''):
            value = req.get(name)
            if isinstance(value, str):
                value = value.strip().replace(',', '.')
                if not value:
                    continue
            try:
                return float(value)
            except Exception:
                raise ValueError(f'invalid {name}: {value!r}')
    return float(default)

def parse_month_field(req):
    value = req.get('month', req.get('birthMonth', req.get('monthIndex')))
    if value in (None, ''):
        return 1
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return 1
        lower = raw.lower()
        if lower in MONTHS:
            return MONTHS[lower]
        m = re.search(r'\d+', raw)
        if m:
            parsed = int(m.group(0))
        else:
            raise ValueError(f'invalid month: {value!r}')
    else:
        parsed = int(float(value))
    if 'monthIndex' in req and 'month' not in req and 0 <= parsed <= 11:
        parsed += 1
    if not (1 <= parsed <= 12):
        raise ValueError(f'month must be 1..12, got {parsed}')
    return parsed

def norm(x): return x % 360.0

def kepler_solve(M_rad, e):
    E = M_rad
    for _ in range(20):
        f = E - e * math.sin(E) - M_rad
        fp = 1 - e * math.cos(E)
        if abs(fp) < 1e-12:
            break
        d = f / fp
        E -= d
        if abs(d) < 1e-12:
            break
    return E

# Extended fallback only used when Swiss has no asteroid/Chiron file or a hard date limit.
# It keeps every Wheel Settings object active for all BC/AD years. Swiss is still the
# primary source; fallback positions are marked with source='extended-kepler-fallback'.
EXTENDED_ELEMENTS_J2000 = {
    # a(AU), e, i, node, perihelion longitude, mean longitude at J2000
    'Chiron': (13.64, 0.382, 6.93, 209.4, 548.7, 204.8),
    'Ceres':  (2.7675, 0.0758, 10.593, 80.305, 153.902, 249.841),
    'Pallas': (2.7730, 0.2300, 34.840, 173.100, 83.300, 116.000),
    'Juno':   (2.6700, 0.2560, 12.990, 169.900, 57.900, 60.500),
    'Vesta':  (2.3610, 0.0890, 7.140, 103.800, 254.700, 275.600),
}

GAUSS_N = 0.9856076686

def helio_xyz_from_elements(jd, elements):
    a, e, inc, node, peri_long, mean_long = elements
    d = jd - 2451545.0
    n = GAUSS_N / (a ** 1.5)
    L = norm(mean_long + n * d)
    varpi = norm(peri_long)
    M = math.radians(norm(L - varpi))
    E = kepler_solve(M, e)
    xv = a * (math.cos(E) - e)
    yv = a * (math.sqrt(max(0.0, 1 - e * e)) * math.sin(E))
    v = math.atan2(yv, xv)
    r = math.sqrt(xv * xv + yv * yv)
    arg_peri = math.radians(norm(varpi - node))
    N = math.radians(node)
    I = math.radians(inc)
    u = v + arg_peri
    xh = r * (math.cos(N) * math.cos(u) - math.sin(N) * math.sin(u) * math.cos(I))
    yh = r * (math.sin(N) * math.cos(u) + math.cos(N) * math.sin(u) * math.cos(I))
    zh = r * (math.sin(u) * math.sin(I))
    return xh, yh, zh

def earth_helio_xyz_from_sun(jd):
    # Swiss Sun geocentric vector: approximate Earth heliocentric vector by adding 180°.
    try:
        xx = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SPEED)[0]
    except Exception:
        xx = swe.calc_ut(jd, swe.SUN, swe.FLG_MOSEPH | swe.FLG_SPEED)[0]
    lon = math.radians(norm(xx[0] + 180.0))
    lat = math.radians(-xx[1] if len(xx) > 1 else 0.0)
    r = xx[2] if len(xx) > 2 and xx[2] else 1.0
    return r * math.cos(lat) * math.cos(lon), r * math.cos(lat) * math.sin(lon), r * math.sin(lat)

def fallback_minor_body_position(name, jd, ayan):
    elements = EXTENDED_ELEMENTS_J2000.get(name)
    if not elements:
        raise ValueError(f'no extended fallback for {name}')
    bx, by, bz = helio_xyz_from_elements(jd, elements)
    ex, ey, ez = earth_helio_xyz_from_sun(jd)
    gx, gy, gz = bx - ex, by - ey, bz - ez
    lon = math.degrees(math.atan2(gy, gx))
    return norm(lon - ayan)

def parse_iso(s):
    if not s: raise ValueError('missing utcDate')
    s = s.replace('Z','+00:00')
    # Python datetime does not support astronomical years <= 0. For modern ISO
    # strings use datetime; for expanded signed years the caller must use raw fields.
    if re.match(r'^[+-]\d{6}-', s):
        raise ValueError('expanded astronomical ISO year requires raw fields')
    dt = datetime.datetime.fromisoformat(s)
    if dt.tzinfo is None: dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)

def julday(dt):
    return swe.julday(dt.year, dt.month, dt.day, dt.hour + dt.minute/60 + dt.second/3600 + dt.microsecond/3.6e9, swe.GREG_CAL)

def historical_to_astronomical(year):
    y = int(year)
    # The UI accepts astronomical year 0 for users who explicitly type 0.
    # Negative typed years keep the user's BC convention: -7 = 7 BC = astronomical -6.
    if y == 0:
        return 0
    return y + 1 if y < 0 else y

def julday_from_request(req):
    # Prefer raw fields. JavaScript Date cannot reliably represent BCE years,
    # and the form may send month as text (December/Dezembro) or null.
    if any(k in req for k in ('historicalYear','year','birthYear')):
        y_raw = req.get('historicalYear', req.get('year', req.get('birthYear')))
        y = historical_to_astronomical(parse_int_field({'year': y_raw}, ['year']))
        m = parse_month_field(req)
        d = parse_int_field(req, ['day','birthDay'], default=1, min_value=1, max_value=31)
        hour = parse_float_field(req, ['hour','birthHour','hourString'], default=0)
        minute = parse_float_field(req, ['minute','birthMinute','minuteString'], default=0)
        second = parse_float_field(req, ['second'], default=0)
        offset = parse_float_field(req, ['utcOffset','utc','timezoneOffset','timezone_offset','utc_offset'], default=0)
        ut = hour - offset + minute / 60.0 + second / 3600.0
        base = swe.julday(y, m, d, 0.0, swe.GREG_CAL)
        return base + ut / 24.0
    dt = parse_iso(req.get('utcDate'))
    return julday(dt)

def point(jd, body, ayan):
    flags = swe.FLG_SWIEPH | swe.FLG_SPEED
    result = swe.calc_ut(jd, body, flags)
    # pyswisseph versions return either (xx, retflag) or just xx-like data.
    xx = result[0] if isinstance(result, tuple) and result and isinstance(result[0], (tuple, list)) else result
    pos = norm(xx[0] - ayan)
    return pos, xx[3] if len(xx) > 3 else 0

def calculate_payload(req):
    jd = julday_from_request(req)
    lat = parse_float_field(req, ['lat','latitude'], default=0)
    lon = parse_float_field(req, ['long','lon','longitude'], default=0)
    ayan = parse_float_field(req, ['ayanamsa'], default=0)
    house_code = str(req.get('houseSystemCode') or 'P')[:1].encode('ascii', 'ignore') or b'P'

    out = {"success": True, "engine": "Swiss Ephemeris / pyswisseph", "julianDay": jd, "positions": {}, "houseCusps": []}

    bodies = {
        'Sun': swe.SUN, 'Moon': swe.MOON, 'Mercury': swe.MERCURY, 'Venus': swe.VENUS,
        'Mars': swe.MARS, 'Jupiter': swe.JUPITER, 'Saturn': swe.SATURN,
        'Uranus': swe.URANUS, 'Neptune': swe.NEPTUNE, 'Pluto': swe.PLUTO,
        'Chiron': swe.CHIRON, 'Ceres': swe.CERES, 'Pallas': swe.PALLAS,
        'Juno': swe.JUNO, 'Vesta': swe.VESTA,
    }
    for name, body in bodies.items():
        try:
            pos, speed = point(jd, body, ayan)
            out['positions'][name] = {"position": pos, "speed": speed, "retrograde": speed < 0, "source": "Swiss Ephemeris"}
        except Exception as exc:
            # Never disable configured Wheel Settings objects. If Swiss cannot
            # compute a minor body for a very old date or missing asteroid file,
            # return an extended deterministic fallback instead of hiding it.
            try:
                pos = fallback_minor_body_position(name, jd, ayan)
                out['positions'][name] = {"position": pos, "speed": 0, "retrograde": False, "source": "extended-kepler-fallback", "swissWarning": str(exc)}
            except Exception as exc2:
                out['positions'][name] = {"position": 0.0, "speed": 0, "retrograde": False, "source": "always-enabled-fallback", "swissWarning": f"{exc}; fallback failed: {exc2}"}

    true_node, ns = point(jd, swe.TRUE_NODE, ayan)
    mean_node, ms = point(jd, swe.MEAN_NODE, ayan)
    node_speed = ns if req.get('trueNodes', True) else ms
    node_position = true_node if req.get('trueNodes', True) else mean_node
    out['positions']['North Node'] = {"position": node_position, "speed": node_speed, "retrograde": node_speed < 0}
    out['positions']['South Node'] = {"position": norm(node_position+180), "speed": node_speed, "retrograde": node_speed < 0}

    lil_body = swe.OSCU_APOG if req.get('trueLilith', False) else swe.MEAN_APOG
    lil, ls = point(jd, lil_body, ayan)
    out['positions']['Lilith'] = {"position": lil, "speed": ls, "retrograde": ls < 0}
    out['positions']['Priapus'] = {"position": norm(lil + 180), "speed": ls, "retrograde": ls < 0}

    # Houses and angles. Swiss houses are tropical; convert to selected sidereal zodiac by subtracting ayanamsa.
    try:
        cusps, ascmc = swe.houses_ex(jd, lat, lon, house_code, swe.FLG_SWIEPH)
    except Exception:
        cusps, ascmc = swe.houses_ex(jd, lat, lon, b'P', swe.FLG_SWIEPH)
    def cusp_position(c):
        return norm(c - ayan)

    for i, c in enumerate(cusps, start=1):
        out['houseCusps'].append({"house": i, "position": cusp_position(c)})
    house_anchor = {item['house']: item['position'] for item in out['houseCusps']}

    def anchored_angle(position, house_number):
        # Keep the real astronomical angle in `position`, but provide an explicit
        # render anchor so the frontend can glue ASC/DS/IC/MC to House 1/7/4/10
        # for every house system, including Whole Sign and Equal variants where
        # MC/IC are not necessarily the 10th/4th cusps.
        return {
            "position": norm(position),
            "houseAnchorPosition": norm(house_anchor.get(house_number, position)),
            "houseAnchorHouse": house_number,
        }

    asc_pos = cusp_position(ascmc[0])
    mc_pos = cusp_position(ascmc[1])
    vertex_pos = cusp_position(ascmc[3])
    out['positions']['Ascendant Symbol'] = anchored_angle(asc_pos, 1)
    out['positions']['Midheaven'] = anchored_angle(mc_pos, 10)
    out['positions']['Descendant'] = anchored_angle(norm(asc_pos + 180), 7)
    out['positions']['Imum Coeli'] = anchored_angle(norm(mc_pos + 180), 4)
    out['positions']['Vertex'] = {"position": vertex_pos}
    out['positions']['Anti-Vertex'] = {"position": norm(vertex_pos + 180)}

    # Arabic parts must be recomputed from the final Swiss Sun/Moon/ASC.
    sun = out['positions'].get('Sun', {}).get('position')
    moon = out['positions'].get('Moon', {}).get('position')
    if isinstance(sun, (int, float)) and isinstance(moon, (int, float)):
        # Day formula used by the user's reference charts:
        # Fortune = ASC + Moon - Sun, Spirit = ASC + Sun - Moon.
        out['positions']['Part of Fortune'] = {"position": norm(asc_pos + moon - sun)}
        out['positions']['Part of Spirit'] = {"position": norm(asc_pos + sun - moon)}

    # Sagittarius A*/Galactic Centre from Swiss fixed-star catalogue only.
    # No fabricated fallback: if Swiss cannot return it for the requested date,
    # the frontend must show it as unavailable instead of inventing a longitude.
    try:
        star_result = swe.fixstar2_ut('Gal. Center', jd, swe.FLG_SWIEPH | swe.FLG_SPEED)
        star = star_result[0] if isinstance(star_result, tuple) and star_result and isinstance(star_result[0], (tuple, list)) else star_result
        gc_pos = norm(star[0] - ayan)
        out['positions']['Galactic Center'] = {"position": gc_pos, "source": "Swiss fixstar2_ut"}
    except Exception as exc:
        # Keep Centro Galáctico enabled for every historical date. This constant
        # is the standard tropical Sagittarius A* region, used only if the Swiss
        # fixed-star catalogue cannot answer.
        gc_fallback = norm(266.41683 - ayan)
        out['positions']['Galactic Center'] = {"position": gc_fallback, "source": "fallback-galactic-center", "swissWarning": str(exc)}

    return out

def main():
    req = json.loads(sys.stdin.read() or '{}')
    if isinstance(req.get('batch'), list):
        common = {k: v for k, v in req.items() if k != 'batch'}
        results = []
        for idx, item in enumerate(req.get('batch') or []):
            try:
                if not isinstance(item, dict):
                    raise ValueError('batch item must be an object')
                item_req = {**common, **item}
                result = calculate_payload(item_req)
                result['batchIndex'] = idx
                results.append(result)
            except Exception as exc:
                results.append({"success": False, "batchIndex": idx, "error": str(exc)})
        print(json.dumps({"success": True, "engine": "Swiss Ephemeris / pyswisseph", "results": results}))
        return

    print(json.dumps(calculate_payload(req)))

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
