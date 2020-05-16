const TP = this.TP || {};

TP.MODULENAME = "foundry-patrol";
TP["PATROLCONFIG"] = [
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
            name: "Enable GLOBAL Token Rotation: ",
            hint: "Enables tokens to face the direction their route moves them. Good with topdown tokens",
            type: Boolean,
            default: false,
            scope: "world",
            config: true,
        },
    },
    {
        key: "disableHUD",
        settings: {
            name: "Disable the tokenPatroller HUD",
            hint: "Disables the HUD to allow for a clear menu. Optimal when used with keybindings",
            type: Boolean,
            default: false,
            scope: "client",
            config: true,
        },
    },
    {
        key: "startRoute",
        settings: {
            name: "Start Routes Hotkey",
            hint: "Enter a keybinding for start routes.",
            type: window.Azzu.SettingsTypes.KeyBinding,
            default: "Ctrl + Shift + G",
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
            default: "Ctrl + Shift + H",
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
            default: "Ctrl + Shift + R",
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
            default: "Ctrl + Shift + C",
            scope: "client",
            config: true,
        },
    },

    {
        key: "generateMacro",
        settings: {
            name: "Macro Generation HotKey",
            hint: "Enter a keybinding to generate a patrol macro.",
            type: window.Azzu.SettingsTypes.KeyBinding,
            default: "Ctrl + Shift + M",
            scope: "client",
            config: true,
        },
    },
];

/* Future Settings
    {
        key: "changeColor",
        settings: {
            name: "Change Route Color HotKey",
            hint: "Enter a keybinding to change a route's color.",
            type: window.Azzu.SettingsTypes.KeyBinding,
            default: "Shift + Q",
            scope: "client",
            config: true,
        },
    },
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
    }
*/
