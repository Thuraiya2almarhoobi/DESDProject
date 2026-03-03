(function () {
  const ALLERGENS = [
    "Celery (including stalks, leaves, seeds, and root)",
    "Cereals containing gluten (such as wheat, rye, barley, and oats)",
    "Crustaceans (such as prawns, crabs, and lobsters)",
    "Eggs",
    "Fish",
    "Lupin (flour and seeds)",
    "Milk (including lactose)",
    "Molluscs (such as mussels, oysters, and squid)",
    "Mustard",
    "Peanuts",
    "Sesame seeds",
    "Soybeans",
    "Sulphur dioxide and sulphites (at concentrations above 10 parts per million)",
    "Tree nuts (almonds, hazelnuts, walnuts, cashews, pecans, brazil nuts, pistachios, macadamia nuts)",
  ];
  const PRODUCER_API_PATHS = [
    "/api/producer/products/",
    "/api/producer/public/products/",
  ];

  function isProducerApiRequest(url) {
    if (typeof url !== "string") {
      return false;
    }
    return PRODUCER_API_PATHS.some(function (path) {
      return url.indexOf(path) !== -1;
    });
  }

  function normalizeAllergenPayload(payload) {
    if (Array.isArray(payload)) {
      return payload.map(normalizeAllergenPayload);
    }
    if (!payload || typeof payload !== "object") {
      return payload;
    }

    const copy = Array.isArray(payload) ? payload.slice() : Object.assign({}, payload);
    if (Array.isArray(copy.allergen_information)) {
      copy.allergen_information = copy.allergen_information.join(", ");
    }
    return copy;
  }

  function patchFetchForLegacyProducerBundle() {
    if (typeof window.fetch !== "function" || window.fetch.__producerAllergenPatched) {
      return;
    }

    const originalFetch = window.fetch.bind(window);

    async function patchedFetch(input, init) {
      const response = await originalFetch(input, init);
      const requestUrl = typeof input === "string" ? input : input && input.url;

      if (!isProducerApiRequest(requestUrl)) {
        return response;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.indexOf("application/json") === -1) {
        return response;
      }

      const text = await response.clone().text();
      if (!text) {
        return response;
      }

      try {
        const parsed = JSON.parse(text);
        const normalized = normalizeAllergenPayload(parsed);
        return new Response(JSON.stringify(normalized), {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        });
      } catch (error) {
        void error;
        return response;
      }
    }

    patchedFetch.__producerAllergenPatched = true;
    window.fetch = patchedFetch;
  }

  function parseSelectedValue(value) {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string");
      }
    } catch (error) {
      void error;
    }
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function setReactInputValue(input, nextValue) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (descriptor && typeof descriptor.set === "function") {
      descriptor.set.call(input, nextValue);
    } else {
      input.value = nextValue;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function buildCheckboxList(input) {
    const wrapper = input.closest(".space-y-2");
    if (!wrapper || wrapper.dataset.allergenPatched === "true") {
      return;
    }

    wrapper.dataset.allergenPatched = "true";

    const label = wrapper.querySelector('label[for="new-allergens"]');
    if (label) {
      label.textContent = "Allergen Information";
    }

    input.type = "hidden";
    input.setAttribute("aria-hidden", "true");
    input.tabIndex = -1;

    const panel = document.createElement("div");
    panel.setAttribute("data-allergen-checkbox-panel", "true");
    panel.style.border = "1px solid rgb(226, 232, 240)";
    panel.style.borderRadius = "8px";
    panel.style.background = "rgb(248, 250, 252)";
    panel.style.padding = "12px";
    panel.style.maxHeight = "280px";
    panel.style.overflowY = "auto";

    const helper = document.createElement("p");
    helper.textContent = "Select every allergen present in this product.";
    helper.style.margin = "0 0 12px 0";
    helper.style.fontSize = "0.875rem";
    helper.style.color = "rgb(71, 85, 105)";
    panel.appendChild(helper);

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gap = "10px";
    panel.appendChild(list);

    const selected = new Set(parseSelectedValue(input.value));

    function syncInput() {
      const ordered = ALLERGENS.filter((item) => selected.has(item));
      setReactInputValue(input, JSON.stringify(ordered));
    }

    ALLERGENS.forEach(function (allergen, index) {
      const row = document.createElement("label");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "18px minmax(0, 1fr)";
      row.style.alignItems = "start";
      row.style.gap = "10px";
      row.style.cursor = "pointer";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = "producer-allergen-" + index;
      checkbox.checked = selected.has(allergen);
      checkbox.style.marginTop = "3px";

      const text = document.createElement("span");
      text.textContent = allergen;
      text.style.fontSize = "0.875rem";
      text.style.lineHeight = "1.4";
      text.style.color = "rgb(51, 65, 85)";

      checkbox.addEventListener("change", function () {
        if (checkbox.checked) {
          selected.add(allergen);
        } else {
          selected.delete(allergen);
        }
        syncInput();
      });

      row.appendChild(checkbox);
      row.appendChild(text);
      list.appendChild(row);
    });

    input.insertAdjacentElement("afterend", panel);
    syncInput();
  }

  function patchDialog() {
    const input = document.querySelector("#new-allergens");
    if (input instanceof HTMLInputElement) {
      buildCheckboxList(input);
    }
  }

  function patchProducerDialogScroll() {
    const input = document.querySelector("#new-name");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const dialog =
      input.closest('[data-slot="dialog-content"]') ||
      input.closest('[role="dialog"]');

    if (!(dialog instanceof HTMLElement) || dialog.dataset.producerScrollPatched === "true") {
      return;
    }

    dialog.dataset.producerScrollPatched = "true";
    dialog.style.maxHeight = "calc(100vh - 2rem)";
    dialog.style.overflowY = "auto";
    dialog.style.overscrollBehavior = "contain";

    const form = dialog.querySelector("form");
    if (form instanceof HTMLFormElement) {
      form.style.maxHeight = "none";
      form.style.overflow = "visible";
    }
  }

  function unlockPageScrollIfNeeded() {
    const hasOpenDialog = document.querySelector('[data-slot="dialog-content"][data-state="open"], [role="dialog"]');
    if (!hasOpenDialog) {
      document.documentElement.style.overflowY = "auto";
      document.body.style.overflowY = "auto";
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = "auto";
      }
      if (document.documentElement.style.overflow === "hidden") {
        document.documentElement.style.overflow = "auto";
      }
    }
  }

  const observer = new MutationObserver(function () {
    patchDialog();
    patchProducerDialogScroll();
    unlockPageScrollIfNeeded();
  });

  patchFetchForLegacyProducerBundle();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        patchDialog();
        patchProducerDialogScroll();
        unlockPageScrollIfNeeded();
      },
      { once: true }
    );
  } else {
    patchDialog();
    patchProducerDialogScroll();
    unlockPageScrollIfNeeded();
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
