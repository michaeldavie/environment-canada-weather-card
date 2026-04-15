/**
 * Environment Canada Weather Card for Home Assistant
 *
 * Uses a weather entity for forecast data but overrides the current
 * condition text and icon using separate Environment Canada sensors.
 *
 * Install via HACS: https://github.com/michaeldavie/environment-canada-weather-card
 */

class EnvironmentCanadaWeatherCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("environment-canada-weather-card-editor");
  }

  static getStubConfig() {
    return {
      weather_entity: "weather.ottawa_kanata_orleans_forecast",
      condition_sensor: "sensor.ottawa_kanata_orleans_condition",
      icon_code_sensor: "sensor.ottawa_kanata_orleans_icon_code",
      wind_chill_sensor: "sensor.ottawa_kanata_orleans_wind_chill",
      humidex_sensor: "sensor.ottawa_kanata_orleans_humidex",
      icon_path: "/hacsfiles/environment-canada-weather-card/weather-icons/EnvironmentCanada",
      icon_extension: "svg",
      name: "Weather"
    };
  }

  constructor() {
    super();
    this._forecast = [];
    this._forecastSubscription = null;
    this._subscribing = false;
    this._updateTimeout = null;
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;

    if (!this._config) {
      return;
    }

    // Subscribe to forecast if not already subscribed (and not currently subscribing)
    if (hass && hass.connection && !this._forecastSubscription && !this._subscribing) {
      this._subscribeForecast();
    }

    // Debounce updates to prevent excessive DOM thrashing
    clearTimeout(this._updateTimeout);
    this._updateTimeout = setTimeout(() => this._updateCard(), 50);
  }

  setConfig(config) {
    if (!config.weather_entity) {
      throw new Error("You must specify a weather_entity");
    }
    if (!config.condition_sensor) {
      throw new Error("You must specify a condition_sensor");
    }
    if (!config.icon_code_sensor) {
      throw new Error("You must specify an icon_code_sensor");
    }

    // Unsubscribe from old forecast if config changes
    if (this._forecastSubscription) {
      this._forecastSubscription();
      this._forecastSubscription = null;
    }

    this._config = {
      icon_path: "/hacsfiles/environment-canada-weather-card/weather-icons/EnvironmentCanada",
      icon_extension: "svg",
      show_forecast: true,
      forecast_type: "daily",
      name: "",
      ...config
    };

    this._forecast = [];
    this._createCard();

    // Re-subscribe with new config
    if (this._hass && this._hass.connection) {
      this._subscribeForecast();
    }
  }

  async _subscribeForecast() {
    // Prevent concurrent subscription attempts (race condition fix)
    if (this._subscribing || this._forecastSubscription) {
      return;
    }

    if (!this._hass || !this._hass.connection || !this._config) {
      return;
    }

    this._subscribing = true;

    try {
      this._forecastSubscription = await this._hass.connection.subscribeMessage(
        (event) => {
          this._forecast = event.forecast || [];
          // Debounce forecast-triggered updates as well
          clearTimeout(this._updateTimeout);
          this._updateTimeout = setTimeout(() => this._updateCard(), 50);
        },
        {
          type: "weather/subscribe_forecast",
          entity_id: this._config.weather_entity,
          forecast_type: this._config.forecast_type
        }
      );
    } catch (e) {
      console.warn("Environment Canada Weather Card: Could not subscribe to forecast", e);
      // Fallback to attribute-based forecast (older HA versions)
      this._forecast = [];
    } finally {
      this._subscribing = false;
    }
  }

  disconnectedCallback() {
    // Clean up subscription
    if (this._forecastSubscription) {
      this._forecastSubscription();
      this._forecastSubscription = null;
    }
    // Clean up pending timeout to prevent updates after disconnect
    clearTimeout(this._updateTimeout);
    this._updateTimeout = null;
  }

  _createCard() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          padding: 16px;
          box-sizing: border-box;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .name {
          font-size: 1.2em;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .current {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }
        .current-icon {
          width: 64px;
          height: 64px;
          flex-shrink: 0;
        }
        .current-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .current-info {
          flex-grow: 1;
        }
        .current-temp {
          font-size: 2.5em;
          font-weight: 400;
          line-height: 1;
          color: var(--primary-text-color);
        }
        .current-temp .unit {
          font-size: 0.5em;
          vertical-align: super;
          color: var(--secondary-text-color);
        }
        .current-condition {
          font-size: 1.1em;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
        .attributes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
          margin-bottom: 16px;
          font-size: 0.9em;
          color: var(--secondary-text-color);
        }
        .attribute {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .attribute ha-icon {
          --mdc-icon-size: 18px;
          color: var(--secondary-text-color);
        }
        .forecast {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid var(--divider-color);
          padding-top: 16px;
        }
        .forecast-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          text-align: center;
        }
        .forecast-day .weekday {
          font-size: 0.9em;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
        }
        .forecast-day .icon {
          width: 32px;
          height: 32px;
          margin-bottom: 4px;
        }
        .forecast-day .icon ha-icon {
          --mdc-icon-size: 32px;
          color: var(--secondary-text-color);
        }
        .forecast-day .temp-high {
          font-size: 1em;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .forecast-day .temp-low {
          font-size: 0.9em;
          color: var(--secondary-text-color);
        }
        .unavailable {
          padding: 16px;
          text-align: center;
          color: var(--secondary-text-color);
        }
      </style>
      <ha-card>
        <div class="content"></div>
      </ha-card>
    `;

    this._content = this.shadowRoot.querySelector(".content");
  }

  _updateCard() {
    if (!this._content || !this._hass || !this._config) {
      return;
    }

    const weather = this._hass.states[this._config.weather_entity];
    const conditionSensor = this._hass.states[this._config.condition_sensor];
    const iconCodeSensor = this._hass.states[this._config.icon_code_sensor];

    if (!weather) {
      this._content.innerHTML = `
        <div class="unavailable">
          Weather entity not available: ${this._config.weather_entity}
        </div>
      `;
      return;
    }

    const temperature = weather.attributes.temperature;
    const temperatureUnit = weather.attributes.temperature_unit || "°C";
    const condition = conditionSensor ? conditionSensor.state : weather.state;
    const iconCode = iconCodeSensor ? iconCodeSensor.state : null;

    // Build icon URL from icon code
    let iconUrl = "";
    if (iconCode && iconCode !== "unknown" && iconCode !== "unavailable") {
      // Pad to 2 digits if needed
      const paddedCode = iconCode.toString().padStart(2, "0");
      iconUrl = `${this._config.icon_path}/${paddedCode}.${this._config.icon_extension}`;
    }

    // Use subscribed forecast, fallback to attribute (older HA)
    const forecast = this._forecast.length > 0
      ? this._forecast
      : (weather.attributes.forecast || []);

    // Build the card HTML
    let html = "";

    // Header with name (if provided)
    if (this._config.name) {
      html += `
        <div class="header">
          <div class="name">${this._config.name}</div>
        </div>
      `;
    }

    // Current conditions
    html += `
      <div class="current">
        <div class="current-icon">
          ${iconUrl ? `<img src="${iconUrl}" alt="${condition}">` : this._getWeatherIcon(weather.state)}
        </div>
        <div class="current-info">
          <div class="current-temp">
            ${Math.round(temperature)}<span class="unit">${temperatureUnit}</span>
          </div>
          <div class="current-condition">${condition}</div>
        </div>
      </div>
    `;

    // Optional attributes (humidity, wind, wind chill, humidex)
    const attrs = weather.attributes;
    const attributeHtml = [];

    if (attrs.humidity !== undefined) {
      attributeHtml.push(`
        <div class="attribute">
          <ha-icon icon="mdi:water-percent"></ha-icon>
          ${attrs.humidity}%
        </div>
      `);
    }

    if (attrs.wind_speed !== undefined) {
      const windUnit = attrs.wind_speed_unit || "km/h";
      attributeHtml.push(`
        <div class="attribute">
          <ha-icon icon="mdi:weather-windy"></ha-icon>
          ${Math.round(attrs.wind_speed)} ${windUnit}
        </div>
      `);
    }

    // Wind chill sensor (only show if not Unknown/unavailable)
    if (this._config.wind_chill_sensor) {
      const windChillSensor = this._hass.states[this._config.wind_chill_sensor];
      if (windChillSensor &&
          windChillSensor.state !== "Unknown" &&
          windChillSensor.state !== "unknown" &&
          windChillSensor.state !== "unavailable") {
        attributeHtml.push(`
          <div class="attribute">
            <ha-icon icon="mdi:snowflake-thermometer"></ha-icon>
            ${Math.round(parseFloat(windChillSensor.state))}° wind chill
          </div>
        `);
      }
    }

    // Humidex sensor (only show if not Unknown/unavailable)
    if (this._config.humidex_sensor) {
      const humidexSensor = this._hass.states[this._config.humidex_sensor];
      if (humidexSensor &&
          humidexSensor.state !== "Unknown" &&
          humidexSensor.state !== "unknown" &&
          humidexSensor.state !== "unavailable") {
        attributeHtml.push(`
          <div class="attribute">
            <ha-icon icon="mdi:sun-thermometer"></ha-icon>
            ${Math.round(parseFloat(humidexSensor.state))}° humidex
          </div>
        `);
      }
    }

    if (attributeHtml.length > 0) {
      html += `<div class="attributes">${attributeHtml.join("")}</div>`;
    }

    // Forecast
    if (this._config.show_forecast && forecast.length > 0) {
      html += `<div class="forecast">`;

      // Show up to 5 days
      const days = this._groupForecastByDay(forecast).slice(0, 5);

      for (const day of days) {
        const weekday = this._getWeekday(day.datetime);
        const forecastCondition = day.condition || "";

        html += `
          <div class="forecast-day">
            <div class="weekday">${weekday}</div>
            <div class="icon">
              ${this._getWeatherIcon(forecastCondition)}
            </div>
            ${day.temperature !== undefined ? `<div class="temp-high">${Math.round(day.temperature)}°</div>` : ""}
            ${day.templow !== undefined ? `<div class="temp-low">${Math.round(day.templow)}°</div>` : ""}
          </div>
        `;
      }

      html += `</div>`;
    }

    this._content.innerHTML = html;
  }

  _groupForecastByDay(forecast) {
    // Group hourly forecasts by day, taking the first entry per day
    // or return daily forecasts as-is
    const days = [];
    const seenDates = new Set();

    for (const entry of forecast) {
      const date = new Date(entry.datetime).toDateString();
      if (!seenDates.has(date)) {
        seenDates.add(date);
        days.push(entry);
      }
    }

    return days;
  }

  _getWeekday(datetime) {
    const date = new Date(datetime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tmrw";
    }

    return date.toLocaleDateString("en-US", { weekday: "short" });
  }

  _getWeatherIcon(condition) {
    // Map weather conditions to Material Design Icons
    const iconMap = {
      "clear-night": "mdi:weather-night",
      "cloudy": "mdi:weather-cloudy",
      "exceptional": "mdi:alert-circle-outline",
      "fog": "mdi:weather-fog",
      "hail": "mdi:weather-hail",
      "lightning": "mdi:weather-lightning",
      "lightning-rainy": "mdi:weather-lightning-rainy",
      "partlycloudy": "mdi:weather-partly-cloudy",
      "pouring": "mdi:weather-pouring",
      "rainy": "mdi:weather-rainy",
      "snowy": "mdi:weather-snowy",
      "snowy-rainy": "mdi:weather-snowy-rainy",
      "sunny": "mdi:weather-sunny",
      "windy": "mdi:weather-windy",
      "windy-variant": "mdi:weather-windy-variant"
    };

    const icon = iconMap[condition] || "mdi:weather-partly-cloudy";
    return `<ha-icon icon="${icon}"></ha-icon>`;
  }

  getCardSize() {
    return 4;
  }
}

// Register the custom card
customElements.define("environment-canada-weather-card", EnvironmentCanadaWeatherCard);

// Register with Home Assistant's custom card registry
window.customCards = window.customCards || [];
window.customCards.push({
  type: "environment-canada-weather-card",
  name: "Environment Canada Weather Card",
  description: "Weather card using Environment Canada condition text, icon codes, wind chill, and humidex sensors",
  preview: true
});

console.info(
  "%c ENVIRONMENT-CANADA-WEATHER-CARD %c v1.3.0 ",
  "color: white; background: #3498db; font-weight: bold;",
  "color: #3498db; background: white; font-weight: bold;"
);
