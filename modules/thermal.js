const _ = imports._;
const Graph = imports.graph;
const bind = imports.bind;
const Terminal = imports.terminal;
const Modules = imports.modules;

const name = "thermal";
const display = _("Thermal");
const additionalSettingKeys = ["mode", "warning", "warning-time", "warning-value"];
const colorSettingKeys = ["thermal"];

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.SensorDataProvider.prototype,

    notificationFormat: "thermal",

    dataMatcher: /([+-]?\d+\.\d+)\xb0C/,

    init: function(){
        this.colorRefs = [];

        Modules.SensorDataProvider.prototype.init.apply(this, arguments);
    },

    parseSensorLine: function(line, lineNumber){
        let name = line.match(/[^:]+/)[0];
        let coreMatch = name.match(/core\s*(\d)/i);

        if(coreMatch !== null)
            this.colorRefs.push(parseInt(coreMatch[1]) % 4 + 1);
        else
            this.colorRefs.push(null);

        this.sensors.push(lineNumber);
        this.sensorNames.push(name);
        this.history.push([]);
    },

    getData: function(){
        Terminal.call(this.path, bind(this.parseResult, this));
    },

    parseResult: function(result){
        Modules.SensorDataProvider.prototype.parseResult.call(this, result);

        if(this.settings.thermalWarning)
            this.checkWarning(this.data[0], _("Temperature was over %s for %fsec"));
    },

    onSettingsChanged: function(){
        if(this.settings.thermalWarning){
            this.notifications = this.settings.thermalWarningTime;
            if(!this.settings.thermalUnit)
                this.settings.thermalWarningValue = (this.settings.thermalWarningValue - 32) * 5 / 9; // Fahrenheit => Celsius
        }
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    labelWidths: [80],
    margin: 180,

    init: function(module){
        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        for(let i = 0, l = module.dataProvider.sensorNames.length; i < l; ++i)
            this.addRow(module.dataProvider.sensorNames[i]);

        delete module.dataProvider.sensorNames;
    },

    update: function(){
        for(let i = 0, l = this.data.length; i < l; ++i)
            this.setText(i, 0, "thermal", this.data[i]);
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.ModulePartPrototype,

    main: {
        value: /^(?:value|v|min|max|m|average|avg|a)$/i,
        sensor: /^(?:sensor|s)(\d+)$/i
    },

    value: function(){
        return this.formatThermal(this.data[0]);
    },

    sensor: function(sensor){
        sensor = parseInt(sensor);
        return this.formatThermal(this.data[sensor]);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(1);

        this.next("thermal");
        this.bar((this.data[0] - this.module.min) / (this.module.max - this.module.min));
    }
};

const historyGraphDisplay = _("Thermal History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.history.length, this.history[0].length, 1, this.module.max, this.module.min);

        this.section = 0;

        // first draw the sensors
        for(let i = 1, l = this.history.length; i < l; ++i){
            // if this sensor is labelled after a cpu core, use a cpu color
            if(this.colorRefs[i])
                this.next(this.modules.cpu.color["core" + this.colorRefs[i]]);
            // otherwise the normal thermal color
            else {
                this.next("thermal");
                this.setAlpha((l - i / 4) / l);
            }

            this.line(this.history[i], i, l);
        }

        // then the min / average / max data
        this.next("thermal");
        this.section = 0;
        this.ctx.setDash([5, 5], 0);
        this.line(this.history[0], 0, this.history.length);
    }
};
