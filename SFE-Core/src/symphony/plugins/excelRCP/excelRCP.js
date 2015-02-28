/**
* Created by whinea on 11/18/2014.
*/
var tableBaseView = require('./views/tableBase.js');

module.exports = {
    pluginName: 'excel-rcp',
    pluginDescription: '',
    pluginVersion: '1.0',

    _isParseable: function(text) {
        return  /Microsoft/i.test(text.find('meta[name=Generator]').attr('content'));
    },

    parse: function(text, opts) {
        var ret = {text: text, useView: false};
        if (this._isParseable(text)) {
            ret = this._extractData(text, opts);
        }
        return ret;
    },

    render: function(opts) {
        var array = opts.data;
        var heading = array.shift();
        _(opts).extend({
            heading: heading,
            rows: array,
            entityName: 'excel-rcp',
            richContent: JSON.stringify([heading].concat(array))
        });
        return new tableBaseView(opts).render(opts);
    },

    _extractData: function(text, opts) {
        var ret = {text: text};
        var generator = text.find('meta[name=Generator]').attr('content');
        //check if Excel
        if (/Excel/i.test(generator)) {
            var tableArray = [];
            $(text).find('tr').each(function(i, tr) {
                var tableRow = [];
                $(tr).find('td').each(function(j, td) {
                    tableRow.push(td.innerText)
                });
                tableArray.push(tableRow);
            });
            ret.entites = JSON.stringify(tableArray);
            ret.type = this.pluginName;
            _(opts).extend({data: tableArray, renderOnlyToken: true});
            ret.view = this.render(opts);
            ret.useView = true;
        }
        else {
            //if no html content, or the copied content is from microsoft product that is not excel e.g  word, outlook, etc. use plain text
            ret.text = $('<div></div>').html(opts.clipboard.getData('text/plain'));
            ret.useView = false;
        }

        return ret;
    }
};