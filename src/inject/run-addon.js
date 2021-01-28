import Localization from "./l10n.js";

const MAIN_JS = "userscript.js";

const path = document.querySelector("script[id='devtools-extension-module']").getAttribute("data-path");
const getURL = (x) => `${path}${x}`;
const scriptUrl = getURL(`addon/${MAIN_JS}`);

let scratchVm;
const oldPrototypes = {
  functionBind: Function.prototype.bind,
};
Function.prototype.bind = function (...args) {
  if (
    args[0] &&
    Object.prototype.hasOwnProperty.call(args[0], "editingTarget") &&
    Object.prototype.hasOwnProperty.call(args[0], "runtime")
  ) {
    scratchVm = args[0];
    Function.prototype.bind = oldPrototypes.functionBind;
    return oldPrototypes.functionBind.apply(this, args);
  } else {
    return oldPrototypes.functionBind.apply(this, args);
  }
};

const addon = {
  self: {
    _isDevtoolsExtension: true,
  },
  tab: {
    traps: {
      onceValues: {
        get vm() {
          return scratchVm;
        },
      },
    },
    scratchClass(...args) {
      const classNamesArr = [
        ...new Set(
          [...document.styleSheets]
            .filter(
              (styleSheet) =>
                !(
                  styleSheet.ownerNode.textContent.startsWith(
                    "/* DO NOT EDIT\n@todo This file is copied from GUI and should be pulled out into a shared library."
                  ) && styleSheet.ownerNode.textContent.includes("input_input-form")
                )
            )
            .map((e) => {
              try {
                return [...e.cssRules];
              } catch (e) {
                return [];
              }
            })
            .flat()
            .map((e) => e.selectorText)
            .filter((e) => e)
            .map((e) => e.match(/(([\w-]+?)_([\w-]+)_([\w\d-]+))/g))
            .filter((e) => e)
            .flat()
        ),
      ];
      let res = "";
      args
        .filter((arg) => typeof arg === "string")
        .forEach((classNameToFind) => {
          res +=
            classNamesArr.find(
              (className) =>
                className.startsWith(classNameToFind + "_") && className.length === classNameToFind.length + 6
            ) || "";
          res += " ";
        });
      if (typeof args[args.length - 1] === "object") {
        const options = args[args.length - 1];
        const classNames = Array.isArray(options.others) ? options.others : [options.others];
        classNames.forEach((string) => (res += string + " "));
      }
      res = res.slice(0, -1);
      // Sanitize just in case
      res = res.replace(/"/g, "");
      return res;
    },
  },
};

const langCode = `; ${document.cookie}`.split("; scratchlanguage=").pop().split(";").shift() || navigator.language;
function getL10NURLs() {
  // Note: not identical to Scratch Addons function
  const urls = [getURL(`l10n/${langCode}`)];
  if (langCode.includes("-")) {
    urls.push(getURL(`l10n/${langCode.split("-")[0]}`));
  }
  const enJSON = getURL("l10n/en");
  if (!urls.includes(enJSON)) urls.push(enJSON);
  return urls;
}
const l10nObject = new Localization(getL10NURLs());

const msg = (key, placeholders) => l10nObject.get(`editor-devtools/${key}`, placeholders);
msg.locale = langCode;

l10nObject.loadByAddonId("editor-devtools").then(() =>
  import(scriptUrl).then((module) =>
    module.default({
      addon,
      global: {},
      console,
      msg,
      safeMsg: (key, placeholders) => l10nObject.escaped(`editor-devtools/${key}`, placeholders),
    })
  )
);
