const TP = this.TP || {};

TP.MODULENAME = "foundry-patrol";
TP["PATROLCONFIG"] = [
    {
        key: "enablePlayerPatrol",
        settings: {
            name: "Player Access",
            hint: "Enables patrol access for player owned tokens.",
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
            choices: undefined,
        },
    },
    {
        key: "drawnRoutes",
        settings: {
            scope: "world",
            default: [],
            type: Object,
        },
    },
    {
        key: "tokenRotation",
        settings: {
            name: "Enable token Rotation: ",
            hint: "Enables tokens to face the direction their route moves them. Good with topdown tokens",
            type: Boolean,
            default: false,
            scope: "world",
            config: true,
        },
    },
    {
        key: "startRoute",
        settings: {
            name: "Start Routes Hotkey",
            hint: "Enter a keybinding for start routes.",
            type: window.Azzu.SettingsTypes.KeyBinding,
            default: "Shift + Alt + R",
            scope: "client",
            config: true,
        },
    },
    {
        key: "stopRoute",
        settings: {
            name: "Start Routes Hotkey",
            hint: "Enter a keybinding to halt routes.",
            type: window.Azzu.SettingsTypes.KeyBinding,
            default: "Shift + Alt + S",
            scope: "client",
            config: true,
        },
    },
    {
        key: "addTokenPoint",
        settings: {
            name: "Start Routes Hotkey",
            hint: "Enter a keybinding to add a plot.",
            type: window.Azzu.SettingsTypes.KeyBinding,
            default: "Shift + Alt + R",
            scope: "client",
            config: true,
        },
    },
    {
        key: "clearRoute",
        settings: {
            name: "Start Routes Hotkey",
            hint: "Enter a keybinding to clear a route.",
            type: window.Azzu.SettingsTypes.KeyBinding,
            default: "Shift + Alt + C",
            scope: "client",
            config: true,
        },
    },
];
