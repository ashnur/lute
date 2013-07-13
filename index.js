void function(root){

    var _ = require('underscore')
        , R = require('rationals')
        , store = require('store')
        , settings = {
            columns: [
                {
                    name: 'length'
                    , title: 'Length'
                }
                , {
                    name: 'diameter'
                    , title: 'Diameter'
                }
            ]
            , row_result: {
                calculate: function (length, diameter){
                    if ( length && diameter ) {
                        //(3.14*((vastagsag/100)*(vastagsag/100))*hosszusag)/4
                        var d = R(diameter)
                            , l = R(length, 4)
                            , slice =  d.times(d).div(R(10000))

                        return Math.PI * slice.times(l).val()
                    } else {
                        return 0
                    }
                }
                , title: 'Volume'
            }
            , group_rows: true
            , columns_result: {
                calculate: function(a, b){
                    return a + b
                }
                , title: 'Sum'
            }
            , precision: 3
        }
        , Backbone = require('backbone')

    Backbone.Memento = require('backbone.memento')(Backbone, _)

    var Row = Backbone.Model.extend({
            initialize: function(attrs){
                this.listenTo(this, 'change', this.change)
            }
            , defaults: function(){
                var defaults = {}
                settings.columns.forEach(function(c){ defaults[c.name] = '' })
                defaults.__rowCounterValue = 1
                return defaults
            }
            , change: function(model, opts){
                var collection = this.collection
                if ( ! opts.counterEvent ) {
                    if ( settings.group_rows ) collection.groupRows(this)
                    collection.maintainDefaultRow()
                }
                this.trigger('displayResult')
                collection.trigger('updateColumnResult')
                collection.save()
            }
            , getFields: function(){
                return settings.columns.map(function(col){
                    return Number(this.get(col.name))
                }, this)
            }
            , getResult: function(){
                return this.get('__rowCounterValue') * settings.row_result.calculate.apply(
                    null
                    , this.getFields()
                )
            }
            , incrementCounter: function(){
                this.set({ __rowCounterValue:  this.get('__rowCounterValue')+1}, {counterEvent: true})
                this.trigger('updateCounter')
            }
            , decrementCounter: function(){
                var collection = this.collection
                if ( this.get('__rowCounterValue') == 1 ) {
                    this.destroy()
                    collection.maintainDefaultRow()
                    collection.trigger('updateColumnResult')
                    collection.save()
                } else {
                    this.set({__rowCounterValue: this.get('__rowCounterValue')-1}, {counterEvent: true})
                    this.trigger('updateCounter')
                }
            }
            , isEmpty: function(){
                return this.getFields().every(function(v){ return v == 0 })
            }
            , compare: function(row){
                var ownFields = this.getFields()
                    , strangerFields = row.getFields()

                return ownFields.every(function(val, idx){
                    return val != '' && val == strangerFields[idx]
                })
            }
        })
        , RowView = Backbone.View.extend({
            tagName: 'div'
            , initialize: function(){
                this.listenTo(this.model, 'destroy', this.remove)
                this.listenTo(this.model, 'displayResult', this.displayResult)
                this.listenTo(this.model, 'updateCounter', this.updateCounter)
            }
            , className: 'row'
            , events: {
                "change": "change"
                , "click .del": "decrementCounter"
            }
            , template: _.template($('#row-tpl').html())
            , change: function(ev){
                this.model.collection.store()
                this.model.set(ev.target.name, ev.target.value)
            }
            , displayResult: function(){
                var result = this.model.getResult()
                this.result.text(result != 0 ? result.toFixed(settings.precision) : '')
            }
            , updateCounter: function(){
                var count = this.model.get('__rowCounterValue')
                this.counter.text(count > 1 ? count : '')
            }
            , decrementCounter: function(ev){
                this.model.decrementCounter()
            }
            , render: function(){
                var columns = settings.columns.map(function(col){
                    return {
                        name: col.name
                        , value: this.model.get(col.name)
                    }
                }, this)
                this.$el.html(this.template({ columns: columns }))
                this.counter = this.$('.counter')
                this.result = this.$('.result')
                return this
            }

        })
        , Sheet = Backbone.Collection.extend({
            model: Row
            , initialize: function(attrs){
                this.maintainDefaultRow()
                this.id = attrs ? attrs.id : _.uniqueId('sheet')
                if ( store.enabled ) {
                    var luteSheets = store.get('lute.sheets')
                    this.localStore = luteSheets || {}
                }
                _.extend(this, new Backbone.Memento(this))
            }
            , maintainDefaultRow: function(){
                var last = this.last()
                if ( ! last || ! last.isEmpty() ) {
                    this.add(new Row())
                }
            }
            , groupRows: function(current){
                var r = this.filter(function(row){
                        return current.cid != row.cid && current.compare(row)
                    })

                if ( r[0] ) {
                    r[0].incrementCounter()
                    current.destroy()
                }
            }
            , save: function(){
                if ( this.localStore ) {
                    this.localStore[this.id] = this.models
                    store.set('lute.sheets', this.localStore)
                    store.set('lute.activeSheet', this.localStore[this.id])
                }
            }
        })
        , SheetView = Backbone.View.extend({
            el: '#container'
            , template: _.template($('#container-tpl').html() )
            , initialize: function(){
                this.listenTo(this.collection, 'add', function(model){
                    this.renderRow(model)
                })
                this.listenTo(this.collection, 'updateColumnResult', function(model){
                    this.updateColumnResult()
                })
                this.listenTo(this.collection, 'reset', this.reset)

            }
            , events: {
                "click .redo": "redo"
                , "click .undo": "undo"
            }
            , undo: function(){
                var collection = this.collection
                collection.undo()
                collection.save()
            }
            , redo: function(){
                var collection = this.collection
                collection.redo()
                collection.save()
            }
            , renderRow: function(model) {
                var rowView = new RowView({ model: model})
                rowView.render()
                this.$('#wrap').append(rowView.el)
            }
            , updateColumnResult: function(){
                var result = this.collection.map(function(model){
                    return model.getResult()
                }).reduce(settings.columns_result.calculate)
                this.result.text(result.toFixed(settings.precision))
            }
            , render: function(){

                this.$el.html(this.template({
                    columns: settings.columns
                    , row_result_title: settings.row_result.title
                }))
                this.collection.map(function(model){
                    this.renderRow(model)
                    model.trigger('updateCounter')
                    model.trigger('displayResult')
                }, this)
                this.result = this.$('.column_result div')
                this.updateColumnResult()
                return this
            }
            , reset: function(collection, options){
                function findModel(list){
                    return function(cid){
                        return _.find(list, function(m){ return m.cid == cid})
                    }
                }
                var previous = options.previousModels
                    , current = collection.models
                    , oldids = _.pluck(previous, 'cid')
                    , newids = _.pluck(current, 'cid')
                    , removed = _.difference(oldids, newids).map(findModel(previous))
                    , added = _.difference(newids, oldids).map(findModel(current))

                removed.forEach(function(m){ m.destroy() })
                added.map(function(m){
                    this.renderRow(m)
                    m.trigger('displayResult')
                    m.trigger('updateCounter')
                }, this)
                this.updateColumnResult()


            }
        })

        , page = new Sheet(store.enabled ? store.get('lute.activeSheet') : null)
        , app = new SheetView({collection: page})

    app.render()

    $('body').append(app.el)

    // Check if a new cache is available on page load.
    window.addEventListener('load', function(e) {
        window.applicationCache.addEventListener('updateready', function(e) {
            if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
                window.applicationCache.swapCache();
            }
        }, false)
    }, false)
}(this)
