'use strict';

import { dumpTableAsDefinition, dumpTableAsLaravel, dumpTableAsSQLAlchemyPG, dumpTableAsPydantic } from './library/helper';

var creation = function(context) {
    // Get table in opening tab
    let item = context.clickedItem();
    if (item == null) {
        context.alert('Error', 'Please select a Table');
        return;
    }
    dumpTableAsDefinition(context, item);
};

var drop = function(context) {
    // Get table in opening tab
    let item = context.clickedItem();
    if (item == null) {
        context.alert('Error', 'Please select a Table');
        return;
    }
    SystemService.insertToClipboard('DROP ' + item.type() + ' ' + item.nameWithQuotes() + ';');
    SystemService.notify('Copy creation', item.type() + ' ' + item.name() + ' drop statement is copied!');
};

var truncate = function(context) {
    // Get table in opening tab
    let item = context.clickedItem();
    if (item == null) {
        context.alert('Error', 'Please select a Table');
        return;
    }
    SystemService.insertToClipboard('TRUNCATE ' + item.type() +  ' ' + item.nameWithQuotes() + ';');
    SystemService.notify('Copy creation', item.type() + ' ' + item.name() + ' truncate statement is copied!');
};

var laravel = function(context)  {
    // Get table in opening tab
    let item = context.clickedItem();
    if (item == null) {
        context.alert('Error', 'Please select a Table');
        return;
    }
    dumpTableAsLaravel(context, item);
}

var sqlalchemy_pg = function(context)  {
    // Get table in opening tab
    let item = context.clickedItem();
    if (item == null) {
        context.alert('Error', 'Please select a Table');
        return;
    }
    dumpTableAsSQLAlchemyPG(context, item);
}

var pydantic = function(context)  {
    // Get table in opening tab
    let item = context.clickedItem();
    if (item == null) {
        context.alert('Error', 'Please select a Table');
        return;
    }
    dumpTableAsPydantic(context, item);
}

global.creation = creation;
global.drop = drop;
global.truncate = truncate;
global.laravel = laravel;
global.sqlalchemy_pg = sqlalchemy_pg;
global.pydantic = pydantic