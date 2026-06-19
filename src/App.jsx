import { useState, useEffect, useCallback } from "react";
import {
  createTheme, ThemeProvider, CssBaseline,
  AppBar, Toolbar, Typography, Container, Stack,
  Card, CardContent, TextField, Button, Slider,
  Alert, Divider, Box, CircularProgress, Chip,
  ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import WifiIcon from "@mui/icons-material/Wifi";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import LightModeIcon from "@mui/icons-material/LightMode";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import KeyIcon from "@mui/icons-material/Key";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#fff" },
    background: { default: "#0f0f0f", paper: "#1a1a1a" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { border: "1px solid #2a2a2a", backgroundImage: "none" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
});

const DEFAULT_HOST = "http://192.168.3.30";

function StatusRow({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

export default function App() {
  const [host, setHost] = useState(DEFAULT_HOST);
  const [hostInput, setHostInput] = useState(DEFAULT_HOST);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [brightness, setBrightness] = useState(85);
  const [clockStyle, setClockStyle] = useState(0);
  const [timeInput, setTimeInput] = useState({ date: "", time: "" });
  const [timeSaved, setTimeSaved] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [cityState, setCityState] = useState(null); // null | {ok, city} | {error}
  const [owmKeyInput, setOwmKeyInput] = useState("");
  const [owmKeyState, setOwmKeyState] = useState(null);

  const api = useCallback(
    (path, options) =>
      fetch(`${host}${path}`, { ...options, signal: AbortSignal.timeout(5000) }),
    [host]
  );

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api("/api/status");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStatus(data);
      setBrightness(data.brightness);
      setClockStyle(data.clock_style ?? 0);
      setError(null);
    } catch {
      setError("Нет соединения с устройством");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    setLoading(true);
    fetchStatus();
    const t = setInterval(fetchStatus, 10000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  const handleConnect = (e) => {
    e.preventDefault();
    setHost(hostInput.trim());
  };

  const applyBrightness = async (val) => {
    await api(`/api/brightness?value=${val}`, { method: "POST" });
  };

  const applyClockStyle = async (style) => {
    setClockStyle(style);
    await api(`/api/clockstyle?style=${style}`, { method: "POST" });
  };

  const applyTime = async (e) => {
    e.preventDefault();
    if (!timeInput.date || !timeInput.time) return;
    const [year, month, day] = timeInput.date.split("-");
    const [hour, minute] = timeInput.time.split(":");
    await api(
      `/api/time?year=${year}&month=${month}&day=${day}&hour=${hour}&minute=${minute}`,
      { method: "POST" }
    );
    setTimeSaved(true);
    setTimeout(() => setTimeSaved(false), 2500);
  };

  const applyOwmKey = async (e) => {
    e.preventDefault();
    const key = owmKeyInput.trim();
    if (!key) return;
    setOwmKeyState(null);
    try {
      const res = await api(`/api/owmkey?key=${encodeURIComponent(key)}`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setOwmKeyState({ ok: true });
        setOwmKeyInput("");
        setTimeout(fetchStatus, 2000);
      } else {
        setOwmKeyState({ error: data.error || "Ошибка" });
      }
    } catch {
      setOwmKeyState({ error: "Нет соединения" });
    }
  };

  const applyCity = async (e) => {
    e.preventDefault();
    const q = cityInput.trim();
    if (!q) return;
    setCityState(null);
    try {
      const res = await fetch(`${host}/api/city?q=${encodeURIComponent(q)}`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCityState({ ok: true, city: data.city });
        setCityInput("");
        setTimeout(fetchStatus, 1500);
      } else {
        setCityState({ error: "Город не найден" });
      }
    } catch {
      setCityState({ error: "Нет соединения" });
    }
  };

  const setNow = () => {
    const d = new Date();
    setTimeInput({
      date: d.toISOString().slice(0, 10),
      time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="transparent" elevation={0}
        sx={{ borderBottom: "1px solid #1e1e1e" }}>
        <Toolbar>
          <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>
            CarrotOS
          </Typography>
          {status && (
            <Chip
              icon={<WifiIcon sx={{ fontSize: 14 }} />}
              label={`${status.rssi} dBm`}
              size="small"
              variant="outlined"
              sx={{ borderColor: "#333", color: "#888", fontSize: 11 }}
            />
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={2}>

          {/* Подключение */}
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Устройство
              </Typography>
              <Box component="form" onSubmit={handleConnect}
                sx={{ display: "flex", gap: 1, mt: 1 }}>
                <TextField
                  fullWidth size="small"
                  value={hostInput}
                  onChange={(e) => setHostInput(e.target.value)}
                  placeholder="http://192.168.3.30"
                  inputProps={{ spellCheck: false }}
                />
                <Button type="submit" variant="contained" color="primary"
                  sx={{ color: "#000", whiteSpace: "nowrap" }}>
                  Найти
                </Button>
              </Box>
            </CardContent>
          </Card>

          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} sx={{ color: "#555" }} />
            </Box>
          )}

          {error && !loading && (
            <Alert severity="error" sx={{ bgcolor: "#1f1010", color: "#f87171",
              border: "1px solid #4a2020" }}>
              {error} — проверь что устройство в той же WiFi сети
            </Alert>
          )}

          {status && (
            <>
              {/* Статус */}
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Статус
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <StatusRow
                      label={<><ThermostatIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />Погода</>}
                      value={`${status.temp}° ${status.desc}${status.city ? ` · ${status.city}` : ""}`}
                    />
                    <Divider sx={{ borderColor: "#222", my: 0.5 }} />
                    <StatusRow label="IP адрес" value={
                      <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                        {status.ip}
                      </Typography>
                    } />
                    <Divider sx={{ borderColor: "#222", my: 0.5 }} />
                    <StatusRow
                      label={<><WifiIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />WiFi</>}
                      value={`${status.rssi} dBm`}
                    />
                  </Box>
                  <Button size="small" sx={{ mt: 1.5, color: "#666" }}
                    onClick={fetchStatus}>
                    Обновить
                  </Button>
                </CardContent>
              </Card>

              {/* Стиль часов */}
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    <AccessTimeIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: "middle" }} />
                    Стиль часов
                  </Typography>
                  <ToggleButtonGroup
                    value={clockStyle}
                    exclusive
                    onChange={(_, v) => { if (v !== null) applyClockStyle(v); }}
                    fullWidth
                    sx={{ mt: 1.5, gap: 1 }}
                  >
                    <ToggleButton
                      value={0}
                      sx={{
                        flex: 1,
                        border: "1px solid #2a2a2a !important",
                        borderRadius: "10px !important",
                        color: "#fff",
                        "&.Mui-selected": { bgcolor: "#1e1e1e", borderColor: "#555 !important" },
                      }}
                    >
                      Экран 1
                    </ToggleButton>
                    <ToggleButton
                      value={1}
                      sx={{
                        flex: 1,
                        border: "1px solid #2a2a2a !important",
                        borderRadius: "10px !important",
                        color: "#fff",
                        "&.Mui-selected": { bgcolor: "#1e1e1e", borderColor: "#555 !important" },
                      }}
                    >
                      Экран 2
                    </ToggleButton>
                  </ToggleButtonGroup>
                </CardContent>
              </Card>

              {/* Город */}
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    <LocationCityIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: "middle" }} />
                    Город — {status.city || "—"}
                  </Typography>
                  <Box component="form" onSubmit={applyCity}
                    sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                    <TextField
                      fullWidth size="small"
                      placeholder="Москва, London, New York…"
                      value={cityInput}
                      onChange={(e) => { setCityInput(e.target.value); setCityState(null); }}
                      inputProps={{ spellCheck: false }}
                    />
                    <Button type="submit" variant="contained"
                      sx={{ color: "#000", whiteSpace: "nowrap" }}
                      disabled={!cityInput.trim()}>
                      Найти
                    </Button>
                  </Box>
                  {cityState?.ok && (
                    <Typography variant="caption" sx={{ color: "#4ade80", mt: 1, display: "block" }}>
                      Установлено: {cityState.city} — погода обновится через несколько секунд
                    </Typography>
                  )}
                  {cityState?.error && (
                    <Typography variant="caption" sx={{ color: "#f87171", mt: 1, display: "block" }}>
                      {cityState.error}
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* OWM API ключ */}
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    <KeyIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: "middle" }} />
                    OWM API ключ — {status.owm_key || "—"}
                  </Typography>
                  <Box component="form" onSubmit={applyOwmKey}
                    sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                    <TextField
                      fullWidth size="small"
                      placeholder="Новый ключ OpenWeatherMap"
                      value={owmKeyInput}
                      onChange={(e) => { setOwmKeyInput(e.target.value); setOwmKeyState(null); }}
                      inputProps={{ spellCheck: false, style: { fontFamily: "monospace", fontSize: 13 } }}
                    />
                    <Button type="submit" variant="contained"
                      sx={{ color: "#000", whiteSpace: "nowrap" }}
                      disabled={!owmKeyInput.trim()}>
                      Сохранить
                    </Button>
                  </Box>
                  {owmKeyState?.ok && (
                    <Typography variant="caption" sx={{ color: "#4ade80", mt: 1, display: "block" }}>
                      Ключ сохранён — погода обновится через несколько секунд
                    </Typography>
                  )}
                  {owmKeyState?.error && (
                    <Typography variant="caption" sx={{ color: "#f87171", mt: 1, display: "block" }}>
                      {owmKeyState.error}
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* Яркость */}
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    <LightModeIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: "middle" }} />
                    Яркость — {brightness}%
                  </Typography>
                  <Slider
                    value={brightness}
                    min={10} max={100}
                    onChange={(_, v) => setBrightness(v)}
                    onChangeCommitted={(_, v) => applyBrightness(v)}
                    sx={{ mt: 2, color: "#fff" }}
                  />
                  <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setBrightness(12);
                        applyBrightness(12);
                      }}
                    >
                      Night mode
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setBrightness(16);
                        applyBrightness(16);
                      }}
                    >
                      Day mode
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              {/* Время */}
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    <AccessTimeIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: "middle" }} />
                    Дата и время
                  </Typography>
                  <Box component="form" onSubmit={applyTime}>
                    <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
                      <TextField
                        fullWidth size="small" type="date" label="Дата"
                        InputLabelProps={{ shrink: true }}
                        value={timeInput.date}
                        onChange={(e) => setTimeInput((p) => ({ ...p, date: e.target.value }))}
                      />
                      <TextField
                        fullWidth size="small" type="time" label="Время"
                        InputLabelProps={{ shrink: true }}
                        value={timeInput.time}
                        onChange={(e) => setTimeInput((p) => ({ ...p, time: e.target.value }))}
                      />
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Button fullWidth variant="outlined" onClick={setNow}
                        sx={{ borderColor: "#333", color: "#888" }}>
                        Сейчас
                      </Button>
                      <Button fullWidth variant="contained" type="submit"
                        sx={{ color: "#000" }}>
                        {timeSaved ? "Установлено ✓" : "Применить"}
                      </Button>
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </>
          )}

        </Stack>
      </Container>
    </ThemeProvider>
  );
}
