/**
 * The controls over a geo map, which used to be MapLibre's own — white boxes on a map that may well
 * be dark, dressed in neither Trilium's buttons nor its colors. What is checked here is what they
 * did for us: the two steps, a step that would carry the map past either end of the range it is
 * allowed being refused rather than merely doing nothing, and the screen being given and taken
 * back.
 */
import { GeolocateControl, type Map as MapLibreGLMap } from "maplibre-gl";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderInto } from "../../../test/render";
import { ParentMap } from "./map";
import MapToolbar from "./MapToolbar";

const { showError } = vi.hoisted(() => ({ showError: vi.fn() }));
vi.mock("../../../services/toast", () => ({ default: { showError } }));
// t() returns the key, so the assertions below are on which title the button wears rather than on
// its English wording.
vi.mock("../../../services/i18n", () => ({ t: (key: string) => key }));

/** The order the group lays its buttons out in — the image viewer's, with the tilt leading and the
 *  screen at the end. */
const TILT = 0;
const ZOOM_OUT = 1;
const ZOOM_IN = 2;
const LOCATE = 3;
const FULLSCREEN = 4;

/** A map that zooms and tilts, says so, and stands somewhere — all these controls ask of one. */
function fakeMap({ zoom = 5, minZoom = 2, maxZoom = 22, pitch = 0 } = {}) {
    const listeners = new Map<string, Set<() => void>>();
    const fire = (event: string) => {
        for (const listener of listeners.get(event) ?? []) listener();
    };
    const container = document.createElement("div");
    container.requestFullscreen = vi.fn(async () => {});
    document.body.appendChild(container);

    const setZoom = (value: number) => {
        zoom = Math.min(Math.max(value, minZoom), maxZoom);
        fire("zoom");
    };
    const setPitch = (value: number) => {
        pitch = value;
        fire("pitch");
    };
    /** The controls the map holds, which a map being removed lets go of on its own. */
    const controls = new Set<unknown>();

    return {
        addControl: vi.fn((control: unknown) => { controls.add(control); }),
        removeControl: vi.fn((control: unknown) => { controls.delete(control); }),
        hasControl: (control: unknown) => controls.has(control),
        /** The map being torn down, as `map.remove()` does before any cleanup around it runs. */
        remove: () => controls.clear(),
        getZoom: () => zoom,
        getMinZoom: () => minZoom,
        getMaxZoom: () => maxZoom,
        getPitch: () => pitch,
        getContainer: () => container,
        zoomIn: vi.fn(() => setZoom(zoom + 1)),
        zoomOut: vi.fn(() => setZoom(zoom - 1)),
        /** The map being zoomed by something other than these buttons — the wheel, or a pinch. */
        zoomTo: setZoom,
        /** The view being leaned over by hand — Ctrl and a drag, which MapLibre honours itself. */
        tiltTo: setPitch,
        easeTo: vi.fn(({ pitch: leanedTo }: { pitch?: number }) => {
            if (leanedTo !== undefined) setPitch(leanedTo);
        }),
        on: (event: string, listener: () => void) => {
            listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
        },
        off: (event: string, listener: () => void) => { listeners.get(event)?.delete(listener); },
        get listenerCount() {
            let count = 0;
            for (const held of listeners.values()) count += held.size;
            return count;
        }
    };
}

/** Puts the document in or out of fullscreen and tells whoever is listening, as the browser does. */
function setFullscreenElement(element: Element | null) {
    Object.defineProperty(document, "fullscreenElement", { value: element, configurable: true });
    act(() => { document.dispatchEvent(new Event("fullscreenchange")); });
}

beforeEach(() => {
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    document.exitFullscreen = vi.fn(async () => {});
    // What a browser offers on a secure origin, which is the only place the locate button is
    // offered: happy-dom leaves the first undefined and the second null.
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "geolocation", { value: {}, configurable: true });
    // The control's own press, which would otherwise reach for the browser's geolocation.
    vi.spyOn(GeolocateControl.prototype, "trigger").mockReturnValue(true);
    showError.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** Builds the controls over a map and settles them, so they are listening before being spoken to. */
function renderToolbar(map: ReturnType<typeof fakeMap> | null) {
    let container: HTMLElement | undefined;
    act(() => {
        container = renderInto(
            <ParentMap.Provider value={map as unknown as MapLibreGLMap}>
                <MapToolbar />
            </ParentMap.Provider>
        );
    });
    if (!container) throw new Error("the toolbar was not rendered");
    return container;
}

function buttons(container: HTMLElement) {
    return [ ...container.querySelectorAll<HTMLButtonElement>(".tn-overlay-control-group button") ];
}

function press(container: HTMLElement, index: number) {
    act(() => buttons(container)[index].click());
}

/** The locate control the toolbar stood on the map, which the tests speak for as the browser would. */
function controlOn(map: ReturnType<typeof fakeMap>) {
    const control: unknown = map.addControl.mock.calls[0]?.[0];
    if (!(control instanceof GeolocateControl)) throw new Error("no locate control was added");
    return control;
}

describe("geo map MapToolbar", () => {
    it("offers what the map's own controls did, laid out as the image viewer's group", () => {
        const container = renderToolbar(fakeMap());

        expect(buttons(container).map((button) => button.className)).toEqual([
            expect.stringContaining("geo-map-tilt-button"),
            expect.stringContaining("bx-minus-circle"),
            expect.stringContaining("bx-plus-circle"),
            expect.stringContaining("bx-current-location"),
            expect.stringContaining("bx-fullscreen")
        ]);
    });

    it("leans the view over and lays it flat again, its face naming the view it offers", () => {
        const map = fakeMap();
        const container = renderToolbar(map);
        expect(buttons(container)[TILT].textContent).toBe("3D");

        press(container, TILT);

        // Leaned over — by an eased flight rather than a jump — and now offering the way back.
        expect(map.easeTo).toHaveBeenCalled();
        expect(map.getPitch()).toBeGreaterThan(0);
        expect(buttons(container)[TILT].textContent).toBe("2D");

        press(container, TILT);

        expect(map.getPitch()).toBe(0);
        expect(buttons(container)[TILT].textContent).toBe("3D");
    });

    it("counts a tilt dragged in with Ctrl as 3D, the button never having been pressed", () => {
        const map = fakeMap();
        const container = renderToolbar(map);

        // As MapLibre's own Ctrl-drag would, without the button hearing of it directly.
        act(() => map.tiltTo(30));

        expect(buttons(container)[TILT].textContent).toBe("2D");
    });

    it("keeps the zoom steps off a mobile screen, where the fingers already zoom", () => {
        const host = window as unknown as { glob?: { device?: string } };
        host.glob = { device: "mobile" };
        try {
            const container = renderToolbar(fakeMap());

            // The tilt, the device's position and the screen remain — see the mobile note in
            // MapToolbar.tsx.
            expect(buttons(container).map((button) => button.className)).toEqual([
                expect.stringContaining("geo-map-tilt-button"),
                expect.stringContaining("bx-current-location"),
                expect.stringContaining("bx-fullscreen")
            ]);
        } finally {
            delete host.glob;
        }
    });

    it("stands aside until there is a map to zoom", () => {
        const container = renderToolbar(null);

        expect(buttons(container)).toHaveLength(0);
    });

    it("stands MapLibre's locate control on the map with its own button hidden, and takes it off again", () => {
        const map = fakeMap();
        const container = renderToolbar(map);

        expect(map.addControl).toHaveBeenCalledTimes(1);
        const control = controlOn(map);
        // A toggle that follows the device rather than a button that flies there once.
        expect(control.options.trackUserLocation).toBe(true);
        // GPS where the device has it; MapLibre's default settles for a coarse fix.
        expect(control.options.positionOptions?.enableHighAccuracy).toBe(true);

        // MapLibre builds the control's white box; the toolbar wears the button instead.
        const box = document.createElement("div");
        vi.spyOn(GeolocateControl.prototype, "onAdd").mockReturnValue(box);
        expect(control.onAdd(map as unknown as MapLibreGLMap)).toBe(box);
        expect(box.hidden).toBe(true);

        act(() => { render(null, container); });
        expect(map.removeControl).toHaveBeenCalledWith(control);

        // A map torn down first has let go of the control already, and is not asked to again —
        // MapLibre throws for a control it no longer holds.
        const torn = fakeMap();
        const second = renderToolbar(torn);
        torn.remove();
        act(() => { render(null, second); });
        expect(torn.removeControl).not.toHaveBeenCalled();
    });

    it("presses the control's own button, and wears what the control is doing", () => {
        const map = fakeMap();
        const container = renderToolbar(map);
        const control = controlOn(map);
        const button = () => buttons(container)[LOCATE];

        expect(button().getAttribute("aria-label")).toBe("geo-map.locate");
        expect(button().classList.contains("active")).toBe(false);

        press(container, LOCATE);
        expect(control.trigger).toHaveBeenCalledTimes(1);

        // The press as the control reports it: waiting on the browser, then following the fix.
        act(() => { control.fire("trackuserlocationstart"); });
        expect(button().getAttribute("aria-label")).toBe("geo-map.locate-waiting");
        expect(button().classList.contains("active")).toBe(true);
        expect(button().classList.contains("locating")).toBe(true);

        act(() => { control.fire("geolocate", { coords: {}, timestamp: 0 }); });
        expect(button().getAttribute("aria-label")).toBe("geo-map.locate-following");
        expect(button().classList.contains("active")).toBe(true);
        expect(button().classList.contains("locating")).toBe(false);

        // A drag frees the camera. The control says the tracking ended and, in the same breath,
        // that the dot merely lost the camera; the second word is the one that counts.
        act(() => {
            control.fire("trackuserlocationend");
            control.fire("userlocationlostfocus");
        });
        expect(button().getAttribute("aria-label")).toBe("geo-map.locate-return");
        expect(button().classList.contains("active")).toBe(false);

        // Pressed again, the camera returns to the dot.
        act(() => {
            control.fire("trackuserlocationstart");
            control.fire("userlocationfocus");
        });
        expect(button().getAttribute("aria-label")).toBe("geo-map.locate-following");
        expect(button().classList.contains("active")).toBe(true);

        // Pressed while following, the watch stops: the drag's first word with no second one.
        act(() => { control.fire("trackuserlocationend"); });
        expect(button().getAttribute("aria-label")).toBe("geo-map.locate");
        expect(button().classList.contains("active")).toBe(false);
    });

    it("says once when the position cannot be found, and stands down when access is denied", () => {
        const map = fakeMap();
        const container = renderToolbar(map);
        const control = controlOn(map);
        const button = () => buttons(container)[LOCATE];

        act(() => { control.fire("trackuserlocationstart"); });
        act(() => { control.fire("error", { code: 2, message: "unavailable" }); });
        expect(button().getAttribute("aria-label")).toBe("geo-map.locate-error");
        expect(showError).toHaveBeenCalledTimes(1);
        expect(showError).toHaveBeenLastCalledWith("geo-map.location-unavailable");

        // The watch goes on reporting the same failure; the reader was told the first time.
        act(() => { control.fire("error", { code: 2, message: "unavailable" }); });
        expect(showError).toHaveBeenCalledTimes(1);

        // A fix arriving after all takes the word back.
        act(() => { control.fire("geolocate", { coords: {}, timestamp: 0 }); });
        expect(button().getAttribute("aria-label")).toBe("geo-map.locate-following");

        // Denied is the end of it: the control clears its watch, and the button stands down.
        act(() => { control.fire("error", { code: 1, message: "denied" }); });
        expect(button().disabled).toBe(true);
        expect(button().getAttribute("aria-label")).toBe("geo-map.locate-unavailable");
        expect(showError).toHaveBeenLastCalledWith("geo-map.location-denied");
    });

    it("keeps the locate button off a map that cannot ask where the device is", () => {
        // What a browser says of a page served over plain HTTP, where the Geolocation API refuses.
        Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
        const map = fakeMap();
        const container = renderToolbar(map);

        expect(buttons(container).some((button) => button.classList.contains("bx-current-location"))).toBe(false);
        expect(map.addControl).not.toHaveBeenCalled();
    });

    it("zooms the map in either direction", () => {
        const map = fakeMap();
        const container = renderToolbar(map);

        press(container, ZOOM_IN);
        expect(map.zoomIn).toHaveBeenCalled();

        press(container, ZOOM_OUT);
        expect(map.zoomOut).toHaveBeenCalled();
    });

    it("disables the step that would carry the map past the range it is allowed", () => {
        const atTheTop = renderToolbar(fakeMap({ zoom: 22 }));
        expect(buttons(atTheTop)[ZOOM_IN].disabled).toBe(true);
        expect(buttons(atTheTop)[ZOOM_OUT].disabled).toBe(false);

        const atTheBottom = renderToolbar(fakeMap({ zoom: 2 }));
        expect(buttons(atTheBottom)[ZOOM_IN].disabled).toBe(false);
        expect(buttons(atTheBottom)[ZOOM_OUT].disabled).toBe(true);
    });

    it("follows the zoom as the map reports it, not only as the buttons set it", () => {
        const map = fakeMap({ zoom: 5, maxZoom: 6 });
        const container = renderToolbar(map);
        expect(buttons(container)[ZOOM_IN].disabled).toBe(false);

        // As the wheel or a pinch would.
        act(() => map.zoomTo(6));

        expect(buttons(container)[ZOOM_IN].disabled).toBe(true);
    });

    it("gives the map the screen and takes it back, saying which it is offering", () => {
        const map = fakeMap();
        const container = renderToolbar(map);

        press(container, FULLSCREEN);
        // The map itself goes on the screen, not the note's chrome around it.
        expect(map.getContainer().requestFullscreen).toHaveBeenCalled();

        setFullscreenElement(map.getContainer());
        expect(buttons(container)[FULLSCREEN].className).toContain("bx-exit-fullscreen");

        press(container, FULLSCREEN);
        expect(document.exitFullscreen).toHaveBeenCalled();
    });

    it("follows a screen left by pressing Escape rather than by the button", () => {
        const map = fakeMap();
        const container = renderToolbar(map);

        setFullscreenElement(map.getContainer());
        expect(buttons(container)[FULLSCREEN].className).toContain("bx-exit-fullscreen");

        setFullscreenElement(null);

        expect(buttons(container)[FULLSCREEN].className).toContain("bx-fullscreen");
    });

    it("stops listening to a map it is taken off", () => {
        const map = fakeMap();
        const container = renderToolbar(map);
        // One listener for the zoom, one for the pitch.
        expect(map.listenerCount).toBe(2);

        // A map torn down under controls that stayed behind would go on being reported to.
        act(() => { render(null, container); });

        expect(map.listenerCount).toBe(0);
    });
});
