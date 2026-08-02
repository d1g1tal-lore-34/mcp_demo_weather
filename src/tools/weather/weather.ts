export const NWS_API_BASE = "https://api.weather.gov";
export const USER_AGENT = "weather-app/1.0";

export interface AlertFeature {
    properties: {
        event?: string;
        areaDesc?: string;
        severity?: string;
        status?: string;
        headline?: string;
    };
}

export interface ForecastPeriod {
    name?: string;
    temperature?: number;
    temperatureUnit?: string;
    windSpeed?: string;
    windDirection?: string;
    shortForecast?: string;
}

export interface AlertsResponse {
    features: AlertFeature[];
}

export interface PointsResponse {
    properties: {
        forecast?: string;
    };
}

export interface ForecastResponse {
    properties: {
        periods: ForecastPeriod[];
    };
}

export async function makeNWSRequest<T>(url: string): Promise<T | null> {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! statu: ${response.status}`)
        }
        return (await response.json()) as T;
    } catch (error) {
        console.error("Error making NWS request", error)
        return null;
    }
}

export function formatAlert(feature: AlertFeature): string {
    const props = feature.properties;
    return [
        `Event: ${props.event || "Unknown"}`,
        `Area: ${props.areaDesc || "Unknown"}`,
        `Severity: ${props.severity || "Unknown"}`,
        `Status: ${props.status || "Unknown"}`,
        `Headline: ${props.headline || "No headline"}`,
        "---",
    ].join("\n");
}

export function formatForecast(periods: ForecastPeriod[]): string {
    return periods.map((period: ForecastPeriod) =>
        [
            `${period.name || "Unknown"}:`,
            `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
            `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
            `${period.shortForecast || "No forecast available"}`,
            "---",
        ].join("\n"),
    ).join("\n");
}

interface ToolTextResult {
    content: {
        type: "text";
        text: string;
    }[];
    [key: string]: unknown;
}

export async function getAlertsHandler(state: string): Promise<ToolTextResult> {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    if (!alertsData) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to retrieve alerts data",
                },
            ],
        };
    }

    const features = alertsData.features || [];
    if (features.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `No active alerts for ${stateCode}`,
                },
            ],
        };
    }

    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;

    return {
        content: [
            {
                type: "text",
                text: alertsText,
            },
        ],
    };
}

export async function getForecastHandler(latitude: number, longitude: number): Promise<ToolTextResult> {
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
                },
            ],
        };
    }

    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to get forecast URL from grid point data",
                },
            ],
        };
    }

    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
    if (!forecastData) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to retrieve forecast data",
                },
            ],
        };
    }

    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No forecast periods available",
                },
            ],
        };
    }

    const formattedForecast = formatForecast(periods);
    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast}`;

    return {
        content: [
            {
                type: "text",
                text: forecastText,
            },
        ],
    };
}
