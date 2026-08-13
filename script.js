/* =========================================================
   KABIR MOBILE DATA
   Initial PIN + UI logic
   Firebase integration will be connected later.
   ========================================================= */

const DEFAULT_PIN = "0000";
const PIN_STORAGE_KEY = "kabirMobilePin";

let enteredPin = "";

function getSavedPin() {
  const savedPin = localStorage.getItem(PIN_STORAGE_KEY);
  return /^\d{4}$/.test(savedPin || "") ? savedPin : DEFAULT_PIN;
}

function updatePinDots() {
  const dots = document.querySelectorAll("#pinDots span");
  dots.forEach((dot, index) => {
    dot.classList.toggle("filled", index < enteredPin.length);
  });
}

function showPinMessage(message) {
  const messageElement = document.getElementById("pinMessage");
  if (messageElement) {
    messageElement.textContent = message;
  }
}

function unlock() {
  const pinScreen = document.getElementById("pinScreen");
  const appShell = document.getElementById("appShell");

  if (pinScreen) pinScreen.classList.add("hidden");
  if (appShell) appShell.classList.remove("hidden");

  sessionStorage.setItem("kabirMobileUnlocked", "true");
}

function lock() {
  sessionStorage.removeItem("kabirMobileUnlocked");

  const pinScreen = document.getElementById("pinScreen");
  const appShell = document.getElementById("appShell");

  if (appShell) appShell.classList.add("hidden");
  if (pinScreen) pinScreen.classList.remove("hidden");

  enteredPin = "";
  updatePinDots();
  showPinMessage("");
}

function checkPin() {
  if (enteredPin.length !== 4) return;

  if (enteredPin === getSavedPin()) {
    showPinMessage("");
    unlock();
  } else {
    showPinMessage("Incorrect PIN");
    if (navigator.vibrate) navigator.vibrate([35, 35, 35]);

    setTimeout(() => {
      enteredPin = "";
      updatePinDots();
      showPinMessage("");
    }, 550);
  }
}

function addPinDigit(digit) {
  if (enteredPin.length >= 4) return;

  enteredPin += digit;
  updatePinDots();

  if (enteredPin.length === 4) {
    setTimeout(checkPin, 90);
  }
}

function deletePinDigit() {
  if (!enteredPin.length) return;

  enteredPin = enteredPin.slice(0, -1);
  updatePinDots();
  showPinMessage("");
}

function setupPinKeypad() {
  const keypad = document.getElementById("keypad");
  if (!keypad) return;

  keypad.addEventListener("click", (event) => {
    const button = event.target.closest("[data-key]");
    if (!button) return;

    const key = button.dataset.key;

    if (key === "delete") {
      deletePinDigit();
    } else if (/^\d$/.test(key)) {
      addPinDigit(key);
    }
  });
}

function setupKeyboardInput() {
  document.addEventListener("keydown", (event) => {
    const pinScreen = document.getElementById("pinScreen");
    if (!pinScreen || pinScreen.classList.contains("hidden")) return;

    if (/^\d$/.test(event.key)) {
      addPinDigit(event.key);
    } else if (event.key === "Backspace") {
      deletePinDigit();
    }
  });
}

function setupLogout() {
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", lock);
  }
}

function setupChangePin() {
  const button = document.getElementById("changePinButton");
  const box = document.getElementById("changePinBox");
  const saveButton = document.getElementById("savePinButton");
  const message = document.getElementById("changePinMessage");

  if (!button || !box || !saveButton) return;

  button.addEventListener("click", () => {
    box.classList.toggle("hidden");
  });

  saveButton.addEventListener("click", () => {
    const currentPin = document.getElementById("currentPin").value.trim();
    const newPin = document.getElementById("newPin").value.trim();
    const confirmPin = document.getElementById("confirmPin").value.trim();

    if (currentPin !== getSavedPin()) {
      message.textContent = "Current PIN is incorrect.";
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      message.textContent = "New PIN must contain exactly 4 numbers.";
      return;
    }

    if (newPin !== confirmPin) {
      message.textContent = "New PIN and confirmation do not match.";
      return;
    }

    localStorage.setItem(PIN_STORAGE_KEY, newPin);

    document.getElementById("currentPin").value = "";
    document.getElementById("newPin").value = "";
    document.getElementById("confirmPin").value = "";

    message.style.color = "rgba(255,255,255,.75)";
    message.textContent = "PIN changed successfully.";

    setTimeout(() => {
      message.textContent = "";
      message.style.color = "";
    }, 1800);
  });
}

function init() {
  setupPinKeypad();
  setupKeyboardInput();
  setupLogout();
  setupChangePin();
  updatePinDots();

  /*
    For the first version, PIN unlock is handled locally.
    Firebase configuration and secure authentication will be
    connected in the next stage.
  */
}

document.addEventListener("DOMContentLoaded", init);
