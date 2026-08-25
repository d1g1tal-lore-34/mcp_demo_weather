let radarToolEnabled = false;

let notifyToolsChanged: () => void = () => {};

export function isRadarToolEnabled(): boolean {
    return radarToolEnabled;
}

export function toggleRadarTool(): boolean {
    radarToolEnabled = !radarToolEnabled;
    return radarToolEnabled;
}

export function setNotifyToolsChanged(fn: () => void): void {
    notifyToolsChanged = fn;
}

export function resetRegistryForTests(): void {
    radarToolEnabled = false;
    notifyToolsChanged = () => {};
}

export function triggerToolsChanged(): void {
    notifyToolsChanged();
}
