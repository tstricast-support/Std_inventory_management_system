
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useSearchParams as useRouterSearchParams } from "react-router-dom";
import { Minus, Maximize2, Minimize2, X } from "lucide-react";

export const MAX_WINDOWS = 8;
const TITLE_H = 32;

const WinCtx = createContext(null); // which window am I rendered in?
const StateCtx = createContext({ activeView: "home", openViews: new Set() });
const ManagerCtx = createContext(null); // open / close / focus windows

// true when the element is really on screen (elements inside a minimized window are not)
export const isShown = (el) => !!el && el.getClientRects().length > 0;

// Drop-in replacement for react-router's useSearchParams:
//  - window 1        -> the real browser URL (nothing changes for it)
//  - floating window -> its own private "?view=..." kept in memory
export function useSearchParams() {
  const real = useRouterSearchParams();
  const win = useContext(WinCtx);
  return win && win.setParams ? [win.params, win.setParams] : real;
}

// true only for the window you are working in (shortcut keys / events go to it)
export function useWindowActive() {
  const win = useContext(WinCtx);
  return win ? win.active : true;
}

// true inside a floating window (no sidebar there)
export function useWindowFloating() {
  const win = useContext(WinCtx);
  return !!win && !!win.floating;
}

// which page the active window shows + which pages are open in some window (for the toolbar)
export function useWindowState() {
  return useContext(StateCtx);
}

// { go, openView, openWindow, duplicate, closeActive, closeWindow, focus, goIndex, cycle, tile, cascade }
export function useWindows() {
  return useContext(ManagerCtx);
}

const vw = () => window.innerWidth;
const vh = () => window.innerHeight;
const isSmall = () => vw() < 768;
// height of the top toolbar (0 when the user uses the sidebar menu instead)
const topH = () => {
  const el = document.querySelector("[data-win-toolbar]");
  return el && isShown(el) ? el.offsetHeight : 0;
};
// width of the sidebar menu (0 when the toolbar is used, or on a phone) - windows stay to its right
const leftW = () => (!isSmall() && topH() === 0 ? 224 : 0);
const viewOf = (search) => {
  const v = new URLSearchParams(search).get("view") || "home";
  return v === "dashboard" ? "home" : v;
};

function cascadeRect(n) {
  const w = Math.min(920, vw() - 40);
  const h = Math.min(620, vh() - 60);
  const off = (n % 8) * 32;
  return {
    x: Math.max(8, Math.min(leftW() + 24 + off, vw() - w - 8)),
    y: Math.max(topH() + 8, Math.min(topH() + 16 + off, vh() - h - 8)),
    w,
    h,
  };
}

function FloatWin({ w, n, label, active, z, children, api, patch }) {
  const small = isSmall();
  const max = w.max || small; // phones: always full screen
  const left = max ? leftW() : w.x;
  const top = max ? topH() : w.y;
  const width = max ? vw() - leftW() : w.w;
  const height = w.min ? TITLE_H : max ? vh() - topH() : w.h;

  const startDrag = (e) => {
    if (max || e.button !== 0 || e.target.closest("button")) return;
    const sx = e.clientX,
      sy = e.clientY,
      ox = w.x,
      oy = w.y;
    const move = (ev) =>
      patch(w.id, {
        x: ox + ev.clientX - sx,
        y: Math.max(topH(), Math.min(oy + ev.clientY - sy, vh() - TITLE_H)),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX,
      sy = e.clientY,
      ow = w.w,
      oh = w.h;
    const move = (ev) =>
      patch(w.id, {
        w: Math.max(360, ow + ev.clientX - sx),
        h: Math.max(240, oh + ev.clientY - sy),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const btn =
    "p-1 rounded hover:bg-white/20 text-white/90 shrink-0 leading-none";

  return (
    <WinCtx.Provider value={w.ctx}>
      <div
        onPointerDownCapture={() => api.focus(w.id)}
        style={{
          position: "fixed",
          left,
          top,
          width,
          height,
          zIndex: z,
        }}
        className={`flex flex-col rounded-lg overflow-hidden bg-gray-50 border ${
          active ? "border-blue-500 shadow-2xl" : "border-gray-300 shadow-lg"
        }`}
      >
        <div
          onPointerDown={startDrag}
          onDoubleClick={(e) => {
            if (!e.target.closest("button"))
              patch(w.id, { max: !w.max, min: false });
          }}
          style={{ height: TITLE_H }}
          className={`shrink-0 flex items-center gap-2 pl-3 pr-1.5 text-xs select-none text-white ${
            active ? "bg-blue-600" : "bg-[#1f2640]"
          } ${max ? "" : "cursor-move"}`}
        >
          <span className="text-[10px] px-1 rounded bg-white/20">{n}</span>
          <span className="flex-1 truncate font-medium">{label}</span>
          <button
            type="button"
            className={btn}
            title="Minimize"
            onClick={() => patch(w.id, { min: !w.min })}
          >
            <Minus size={13} />
          </button>
          {!small && (
            <button
              type="button"
              className={btn}
              title={w.max ? "Restore" : "Maximize"}
              onClick={() => patch(w.id, { max: !w.max, min: false })}
            >
              {w.max ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          <button
            type="button"
            className={btn}
            title="Close window  (Alt + Shift + W)"
            onClick={() => api.closeWindow(w.id)}
          >
            <X size={14} />
          </button>
        </div>
        {/* kept mounted (just hidden) while minimized, so a half-typed form is never lost */}
        <div
          style={{ display: w.min ? "none" : undefined }}
          className="flex-1 min-h-0 overflow-auto relative"
        >
          {children}
        </div>
        {!w.min && !max && (
          <div
            onPointerDown={startResize}
            title="Drag to resize"
            className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize z-10"
            style={{
              background:
                "linear-gradient(135deg, transparent 50%, rgba(100,116,139,.7) 50%)",
            }}
          />
        )}
      </div>
    </WinCtx.Provider>
  );
}

// labelFor(URLSearchParams) -> text shown in a window's title bar
export function MultiWindow({ children, labelFor, toolbar }) {
  const [mainParams, setMainParams] = useRouterSearchParams();
  const mainSetRef = useRef(setMainParams);
  mainSetRef.current = setMainParams;
  const [wins, setWins] = useState([]); // floating windows only
  const [activeId, setActiveId] = useState(0);

  const winsRef = useRef(wins);
  winsRef.current = wins;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const mainSearchRef = useRef("");
  mainSearchRef.current = mainParams.toString();
  const nextId = useRef(1);
  const zTop = useRef(1);

  const patch = useCallback((id, p) => {
    setWins((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)));
  }, []);

  const setSearch = useCallback((id, next) => {
    setWins((ws) =>
      ws.map((w) => {
        if (w.id !== id) return w;
        const cur = new URLSearchParams(w.search);
        const val = typeof next === "function" ? next(cur) : next;
        return { ...w, search: new URLSearchParams(val || {}).toString() };
      }),
    );
  }, []);

  const api = useMemo(() => {
    const focus = (id) => {
      if (id !== 0) {
        const w = winsRef.current.find((x) => x.id === id);
        if (!w) return;
        if (w.z !== zTop.current || w.min) {
          const z = ++zTop.current;
          setWins((ws) =>
            ws.map((x) => (x.id === id ? { ...x, z, min: false } : x)),
          );
        }
      }
      if (activeRef.current !== id) setActiveId(id);
    };
    const openWindow = (search = "") => {
      if (winsRef.current.length + 1 >= MAX_WINDOWS) {
        window.alert(`You can have up to ${MAX_WINDOWS} windows open.`);
        return;
      }
      const id = nextId.current++;
      const r = cascadeRect(winsRef.current.length);
      setWins((ws) => [
        ...ws,
        {
          id,
          search: String(search),
          ...r,
          z: ++zTop.current,
          min: false,
          max: false,
        },
      ]);
      setActiveId(id);
    };
    const closeWindow = (id) => {
      const ids = winsRef.current.map((w) => w.id);
      if (!ids.includes(id)) return;
      if (activeRef.current === id) {
        const rest = winsRef.current.filter((w) => w.id !== id);
        const top = rest.sort((a, b) => b.z - a.z)[0];
        setActiveId(top ? top.id : 0);
      }
      setWins((cur) => cur.filter((w) => w.id !== id));
    };
    const arrange = (mode) => {
      const list = winsRef.current;
      if (!list.length) return;
      if (mode === "cascade") {
        setWins((ws) =>
          ws.map((w, i) => ({
            ...w,
            ...cascadeRect(i),
            min: false,
            max: false,
          })),
        );
        return;
      }
      const left = leftW(),
        top0 = topH();
      const W = vw() - left,
        H = vh() - top0;
      const cols = Math.ceil(Math.sqrt(list.length));
      const rows = Math.ceil(list.length / cols);
      setWins((ws) =>
        ws.map((w, i) => ({
          ...w,
          x: left + (i % cols) * (W / cols),
          y: top0 + Math.floor(i / cols) * (H / rows),
          w: W / cols,
          h: H / rows,
          min: false,
          max: false,
        })),
      );
    };
    const allIds = () => [0, ...winsRef.current.map((w) => w.id)];
    // toolbar click: bring the window that already shows this page to the front, else open it in a new window
    const openView = (view) => {
      const hit = [
        { id: 0, v: viewOf(mainSearchRef.current) },
        ...winsRef.current.map((w) => ({ id: w.id, v: viewOf(w.search) })),
      ].find((e) => e.v === view);
      if (hit) focus(hit.id);
      else openWindow(view === "home" ? "" : `view=${view}`);
    };
    // toolbar click: show this page in the window you are working in (like the side menu)
    const go = (view) => {
      const next = view === "home" ? {} : { view };
      if (activeRef.current === 0) mainSetRef.current(next);
      else setSearch(activeRef.current, next);
    };
    return {
      go,
      openView,
      openWindow,
      focus,
      closeWindow,
      closeActive: () => closeWindow(activeRef.current), // window 1 itself stays
      duplicate: () =>
        openWindow(
          activeRef.current === 0
            ? mainSearchRef.current
            : winsRef.current.find((w) => w.id === activeRef.current)?.search ||
                "",
        ),
      goIndex: (n) => {
        const id = allIds()[n - 1];
        if (id !== undefined) focus(id);
      },
      cycle: (dir) => {
        const ids = allIds();
        const i = ids.indexOf(activeRef.current);
        focus(ids[(i + dir + ids.length) % ids.length]);
      },
      tile: () => arrange("tile"),
      cascade: () => arrange("cascade"),
    };
  }, [setSearch]);

  // several windows may hold unsaved forms: ask before the browser tab is closed / reloaded
  const multi = wins.length > 0;
  useEffect(() => {
    if (!multi) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [multi]);

  // keep floating windows reachable after the browser window gets smaller
  useEffect(() => {
    const fix = () =>
      setWins((ws) =>
        ws.map((w) => ({
          ...w,
          x: Math.max(leftW(), Math.min(w.x, vw() - 120)),
          y: Math.max(topH(), Math.min(w.y, vh() - TITLE_H)),
        })),
      );
    // the user switched between the sidebar menu and the top toolbar
    const onLayout = () => setTimeout(fix, 50);
    window.addEventListener("resize", fix);
    window.addEventListener("app:navlayout", onLayout);
    return () => {
      window.removeEventListener("resize", fix);
      window.removeEventListener("app:navlayout", onLayout);
    };
  }, []);

  const mainCtx = useMemo(
    () => ({ id: 0, active: activeId === 0 }),
    [activeId],
  );

  const ranked = [...wins].sort((a, b) => a.z - b.z);

  const activeSearch =
    activeId === 0
      ? mainParams.toString()
      : wins.find((w) => w.id === activeId)?.search || "";
  const openViewsKey = [mainParams.toString(), ...wins.map((w) => w.search)]
    .map(viewOf)
    .join("|");
  const stateValue = useMemo(
    () => ({
      activeView: viewOf(activeSearch),
      openViews: new Set(openViewsKey.split("|")),
    }),
    [activeSearch, openViewsKey],
  );

  return (
    <ManagerCtx.Provider value={api}>
      <StateCtx.Provider value={stateValue}>{toolbar}</StateCtx.Provider>
      <WinCtx.Provider value={mainCtx}>
        <div onPointerDownCapture={() => api.focus(0)}>{children}</div>
      </WinCtx.Provider>
      {wins.map((w, i) => (
        <FloatWinHost
          key={w.id}
          w={w}
          n={i + 2}
          active={w.id === activeId}
          z={20 + ranked.findIndex((x) => x.id === w.id)}
          label={
            labelFor
              ? labelFor(new URLSearchParams(w.search))
              : new URLSearchParams(w.search).get("view") || "Home"
          }
          api={api}
          patch={patch}
          setSearch={setSearch}
        >
          {children}
        </FloatWinHost>
      ))}
    </ManagerCtx.Provider>
  );
}

// builds the per-window context (private ?view=...) and hands it to the frame
function FloatWinHost({ w, setSearch, active, children, ...rest }) {
  const params = useMemo(() => new URLSearchParams(w.search), [w.search]);
  const setParams = useCallback(
    (next) => setSearch(w.id, next),
    [w.id, setSearch],
  );
  const ctx = useMemo(
    () => ({ id: w.id, active, floating: true, params, setParams }),
    [w.id, active, params, setParams],
  );
  return (
    <FloatWin w={{ ...w, ctx }} active={active} {...rest}>
      {children}
    </FloatWin>
  );
}
