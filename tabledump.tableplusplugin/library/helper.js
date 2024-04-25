"use strict";

function dumpTableAsDefinition(context, item) {
  context.itemDefinition(item, function(creation) {
    SystemService.insertToClipboard(creation);
    SystemService.notify(
      "Copy creation",
      item.type() + " " + item.name() + " creation statement is copied!"
    );
  });
}

function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w|_\w)/g, function(letter, index) {
      return letter.toUpperCase();
    })
    .replace(/\s+|-|_/g, "");
}

function getColumnMigrate(columnName, dataType, isNullable, defaultVal, extra, columnComment) {
  var typeArr = dataType.split("(");
  var typeOnly = typeArr[0];
  var typeLength = "";
  if (typeArr.length > 1) {
    typeLength = typeArr[1];
  }
  var migration = "";
  switch (typeOnly) {
    case "varchar":
      if (typeLength.length > 0) {
        migration = "$table->string('" + columnName + "', " + typeLength + "";
      } else {
        migration = "$table->string('" + columnName + "')";
      }
      break;
    case "float":
    case "double":
    case "decimal":
      if (typeLength.length > 0) {
        // Pretty length format: 8,2) => 8, 2)
        typeLength = typeLength.replace(",", ", ");
        migration =
          `$table->${typeOnly}('` + columnName + "', " + typeLength + "";
      } else {
        migration = `$table->${typeOnly}('` + columnName + "')";
      }
      break;
    case "float4":
    case "float8":
      migration = "$table->float('" + columnName + "')";
      break;
    case "char":
      migration = "$table->char('" + columnName + "', " + typeLength + "";
      break;
    case "enum":
      typeLength = typeLength.substring(0, typeLength.length - 1);
      migration = "$table->enum('" + columnName + "', [" + typeLength + "])";
      break;
    case "int8":
    case "bigint":
      migration = "$table->bigInteger('" + columnName + "')";
      break;
    case "int":
    case "int4":
      migration = "$table->integer('" + columnName + "')";
      break;
    case "int3":
    case "mediumint":
      migration = "$table->mediumInteger('" + columnName + "')";
      break;
    case "int2":
    case "smallint":
      migration = "$table->smallInteger('" + columnName + "')";
      break;
    case "int1":
    case "tinyint":
      migration = "$table->tinyInteger('" + columnName + "')";
      break;
    default:
      migration = `$table->${typeOnly}('` + columnName + "')";
      break;
  }
  if (dataType.includes("unsigned")) {
    migration += "->unsigned()";
  }
  
  if (isNullable.toLowerCase().startsWith("y")) {
    migration += "->nullable()";
  }
  
  if (defaultVal) {
    migration += "->default(" + defaultVal + ")";
  }
    
  if (extra) {
    switch (extra) {
      case "auto_increment":
        migration += "->autoIncrement()";
        break;
    }
  }
  
  if (typeof columnComment != 'undefined' && columnComment) {
    migration += "->comment('" + columnComment.trim() + "')";
  }

  return migration + ";";
}

function dumpTableAsLaravel(context, item) {
  var nameCamelcase = camelize(item.name());
  var header = `<?php

use Illuminate\\Support\\Facades\\Schema;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Database\\Migrations\\Migration;

/**
 * Migration auto-generated by TablePlus ${Application.appVersion()}(${Application.appBuild()})
 * @author https://tableplus.com
 * @source https://github.com/TablePlus/tabledump
 */
class Create${nameCamelcase}Table extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('${item.name()}', function (Blueprint $table) {
`;
  var columnNames = [];
  var columnTypes = [];
  var isNullables = [];
  var defaultVals = [];
  var columnComments = [];
  var extras = [];
  var query;
  var driver = context.driver();
  switch (driver) {
    case "MySQL":
    case "MariaDB":
      query = `SELECT ordinal_position as ordinal_position,column_name as column_name,column_type AS data_type,is_nullable as is_nullable,column_default as column_default,extra as extra,column_name AS foreign_key,column_comment AS comment FROM information_schema.columns WHERE table_schema='${item.schema()}'AND table_name='${item.name()}';`;
      break;
    case "PostgreSQL":
      query = `SELECT ordinal_position,column_name,udt_name AS data_type,numeric_precision,datetime_precision,numeric_scale,character_maximum_length AS data_length,is_nullable,column_name as check,column_name as check_constraint,column_default,column_name AS foreign_key,pg_catalog.col_description(16402,ordinal_position) as comment FROM information_schema.columns WHERE table_name='${item.name()}'AND table_schema='${item.schema()}';`;
      break;
    default:
      context.alert("Error", driver + " is not supported");
      return;
  }
  context.execute(query, res => {
    res.rows.sort((l, r) => {
      return (
        parseInt(l.raw("ordinal_position")) >
        parseInt(r.raw("ordinal_position"))
      );
    });
    
    res.rows.forEach(row => {
      let columnName = row.raw("column_name");
      let columnType = row.raw("data_type");
      let isNullable = row.raw("is_nullable");
      let defaultVal = row.raw("column_default");
      let extra = row.raw("extra");
      columnNames.push(columnName);
      columnTypes.push(columnType);
      isNullables.push(isNullable);
      defaultVals.push(defaultVal);
      extras.push(extra);
      columnComments.push(row.raw("comment"));
    });
    
    var result = header;
    
    for (let i = 0; i < columnNames.length; i++) {
      var columnMigrate = getColumnMigrate(
        columnNames[i],
        columnTypes[i],
        isNullables[i],
        defaultVals[i],
        extras[i],
        columnComments[i]
      );
      result += `            ${columnMigrate}\n`;
    }
    result += `        });
    }
   
    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('${item.name()}');
    }
}
`;
    SystemService.insertToClipboard(result);
    SystemService.notify(
      "Laravel export",
      item.type() + " " + item.name() + " export statement is copied!"
    );
  });
}


function getColumnSQLAlchemyPG(columnName, dataType, isNullable, defaultVal, dataLength, columnComment, numericPrecision, numericScale) {
  var typeArr = dataType.split("(");
  var typeOnly = typeArr[0];
  var migration = "";
  switch (typeOnly) {
    case "varchar":
    //case "char":
    case "bpchar":
      if (dataLength && dataLength > 0) {
        migration = `${columnName} = Column(String(${dataLength})`;
      } else {
        migration = `${columnName} = Column(String`;
      }
      break;
    case "_varchar":
      migration = `${columnName} = Column(postgresql.ARRAY(String)`;
      break
    case "decimal":
    case "numeric":
      if (numericPrecision && numericPrecision > 0) {
        // Pretty length format: 8,2) => 8, 2)
        migration = `${columnName} = Column(Numeric(${numericPrecision}, ${numericScale})`;
      } else {
        migration = `${columnName} = Column(Numeric`;
      }
      break;
    case "jsonb":
      migration = `${columnName} = Column(JSONB(none_as_null=True)`;
      break
    case "enum":
      migration = `${columnName} = Column(SQLAlchemyEnum('${dataLength}')`;
      break;
    case "timestamp":
      migration = `${columnName} = Column(DateTime`;
      break
    case "float":
    case "double":
    case "float4":
    case "float8":
      migration = `${columnName} = Column(Float`;
      break;
    case "int8":
    case "bigint":
      migration = `${columnName} = Column(BigInteger`;
      break;
    case "int":
    case "int4":
      migration = `${columnName} = Column(Integer`;
      break;
    case "int3":
    case "mediumint":
      migration = `${columnName} = Column(Integer`;
      break;
    case "int2":
    case "smallint":
      migration = `${columnName} = Column(SmallInteger`;
      break;
    case "int1":
    case "tinyint":
      migration = `${columnName} = Column(SmallInteger`;
      break;
    case "bool":
      migration = `${columnName} = Column(Boolean`;
      break
    case "text":
      migration = `${columnName} = Column(Text`;
      break
    default:
      migration = `${columnName} = Column(${typeOnly}`;
      break;
  }

  if (dataType.includes("unsigned")) {
    //migration += "->unsigned()";
  }
  
  var is_pk = false
  if (defaultVal) {
    if (defaultVal.toLowerCase().startsWith("nextval('")) {
        migration += ", primary_key=True, autoincrement=True";
        is_pk = true
    } else {
        if (typeOnly.toLowerCase().startsWith("int")) {
          migration += ", default=" + defaultVal;
        } else if(typeOnly.toLowerCase() == 'bool') {
          migration += ", default=" + (defaultVal=='true' ? 'True' : 'False');
        } else {
          migration += ", default=" + defaultVal.split("::")[0] + "";
        }
    }
  }

  if (isNullable.toLowerCase().startsWith("no") && !is_pk) {
    migration += ", nullable=False";
  }
  
  if (typeof columnComment != 'undefined' && columnComment) {
    migration += ", comment='" + columnComment.trim() + "'";
  }

  return migration + ")";
}


function dumpTableAsSQLAlchemyPG(context, item) {
  var nameCamelcase = camelize(item.name());
  var header = `

from enum import Enum

from sqlalchemy import Column, SmallInteger, Integer, BigInteger, String, Numeric, Float, DateTime, Boolean, Text, Enum as SQLAlchemyEnum
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB

class ${nameCamelcase}(db_manager.Base):
    """
    Model auto-generated by TablePlus ${Application.appVersion()}(${Application.appBuild()})

    @author https://github.com/junxy
    @source https://github.com/junxy/tabledump

    """
    __tablename__ = '${item.name()}'
    
`;
  var columnNames = [];
  var columnTypes = [];
  var isNullables = [];
  var defaultVals = [];
  var columnComments = [];
  var extras = [];
  var dataLengths = [];
  var numericPrecisions = []
  var numericScales = []
  var query;
  var driver = context.driver();
  switch (driver) {
    case "MySQL":
    case "MariaDB":
      query = `SELECT ordinal_position as ordinal_position,column_name as column_name,column_type AS data_type,is_nullable as is_nullable,column_default as column_default,extra as extra,column_name AS foreign_key,column_comment AS comment FROM information_schema.columns WHERE table_schema='${item.schema()}'AND table_name='${item.name()}';`;
      // break;
      // 暂时不支持
      context.alert("Error", driver + " is not currently supported");
      return;
    case "PostgreSQL":
      query = `SELECT ordinal_position,column_name,udt_name AS data_type,numeric_precision,datetime_precision,numeric_scale,character_maximum_length AS data_length,is_nullable,column_name as check,column_name as check_constraint,column_default,column_name AS foreign_key,pg_catalog.col_description(pg_class.oid,ordinal_position) as comment FROM information_schema.columns JOIN pg_class ON information_schema.columns.table_name = pg_class.relname WHERE table_name='${item.name()}'AND table_schema='${item.schema()}';`;
      break;
    default:
      context.alert("Error", driver + " is not supported");
      return;
  }
  context.execute(query, res => {
    res.rows.sort((l, r) => {
      return (
        parseInt(l.raw("ordinal_position")) >
        parseInt(r.raw("ordinal_position"))
      );
    });
    
    res.rows.forEach(row => {
      let columnName = row.raw("column_name");
      let columnType = row.raw("data_type");
      let isNullable = row.raw("is_nullable");
      let defaultVal = row.raw("column_default");
      let extra = row.raw("extra");
      columnNames.push(columnName);
      columnTypes.push(columnType);
      isNullables.push(isNullable);
      defaultVals.push(defaultVal);
      extras.push(extra);
      columnComments.push(row.raw("comment"));
      dataLengths.push(row.raw("data_length"))
      numericPrecisions.push(row.raw("numeric_precision"))
      numericScales.push(row.raw("numeric_scale"))
    });
    
    var result = header;
    
    for (let i = 0; i < columnNames.length; i++) {
      var columnMigrate = getColumnSQLAlchemyPG(
        columnNames[i],
        columnTypes[i],
        isNullables[i],
        defaultVals[i],
        dataLengths[i],
        columnComments[i],
        numericPrecisions[i],
        numericScales[i]
      );
      result += `    ${columnMigrate}\n`;
    }
    result += `
#end
`;
    SystemService.insertToClipboard(result);
    SystemService.notify(
      "SQLAlchemy(PG) Model export",
      item.type() + " " + item.name() + " export statement is copied!"
    );
  });
}

function getColumnPydantic(columnName, dataType, isNullable, defaultVal, dataLength, columnComment, numericPrecision, numericScale) {
  var typeArr = dataType.split("(");
  var typeOnly = typeArr[0];
  var migration = "";
  switch (typeOnly) {
    case "varchar":
    //case "char":
    case "bpchar":
      if (dataLength && dataLength > 0) {
        migration = `${columnName}: str`;
      } else {
        migration = `${columnName}: str`;
      }
      break;
    case "_varchar":
      migration = `${columnName}: List[str]`;
      break
    case "decimal":
    case "numeric":
      if (numericPrecision && numericPrecision > 0) {
        // Pretty length format: 8,2) => 8, 2)
        // migration = `${columnName}: Decimal(${numericPrecision}, ${numericScale})`;
      } else {
      }
        migration = `${columnName}: Decimal`;
      break;
    case "jsonb":
      migration = `${columnName}: dict`;
      break
    case "enum":
      migration = `${columnName}: enum`;
      break;
    case "timestamp":
      migration = `${columnName}: datetime`;
      break
    case "float":
    case "double":
    case "float4":
    case "float8":
      migration = `${columnName}: float`;
      break;
    case "int8":
    case "bigint":
      migration = `${columnName}: int`;
      break;
    case "int":
    case "int4":
      migration = `${columnName}: int`;
      break;
    case "int3":
    case "mediumint":
      migration = `${columnName}: int`;
      break;
    case "int2":
    case "smallint":
      migration = `${columnName}: int`;
      break;
    case "int1":
    case "tinyint":
      migration = `${columnName}: int`;
      break;
    case "bool":
      migration = `${columnName}: bool`;
      break
    case "text":
      migration = `${columnName}: str`;
      break
    default:
      migration = `${columnName}: object`;
      break;
  }

  if (dataType.includes("unsigned")) {
    //migration += "->unsigned()";
  }

  var is_nullable = false
  if (isNullable.toLowerCase().startsWith("yes")) {
    migration += " | None = Field("
    is_nullable = true
  } else {
    migration += " = Field("
  }
  
  if (defaultVal) {
    if (defaultVal.toLowerCase().startsWith("nextval('")) {
        // migration += ", primary_key=True, autoincrement=True";
    } else {
        if (typeOnly.toLowerCase().startsWith("int")) {
          migration += "" + defaultVal;
        } else if(typeOnly.toLowerCase() == 'bool') {
          migration += "" + (defaultVal=='true' ? 'True' : 'False');
        } else {
          migration += "" + defaultVal.split("::")[0] + "";
        }
    }
  } else {
    if (is_nullable) {
      migration += "None"
    }
  }

  if (typeof columnComment != 'undefined' && columnComment) {
    migration += ", description='" + columnComment.trim() + "'";
  }

  return migration + ")";
}

function dumpTableAsPydantic(context, item) {
  var nameCamelcase = camelize(item.name());
  var header = `

from datetime import datetime
from typing import Optional

from pydantic import Field, BaseModel


class ${nameCamelcase}QueryOut(BaseModel):
    """
    Model auto-generated by TablePlus ${Application.appVersion()}(${Application.appBuild()})

    @author https://github.com/junxy
    @source https://github.com/junxy/tabledump

    """
`;
  var columnNames = [];
  var columnTypes = [];
  var isNullables = [];
  var defaultVals = [];
  var columnComments = [];
  var extras = [];
  var dataLengths = [];
  var numericPrecisions = []
  var numericScales = []
  var query;
  var driver = context.driver();
  switch (driver) {
    case "MySQL":
    case "MariaDB":
      query = `SELECT ordinal_position as ordinal_position,column_name as column_name,column_type AS data_type,is_nullable as is_nullable,column_default as column_default,extra as extra,column_name AS foreign_key,column_comment AS comment FROM information_schema.columns WHERE table_schema='${item.schema()}'AND table_name='${item.name()}';`;
      // break;
      // 暂时不支持
      context.alert("Error", driver + " is not currently supported");
      return;
    case "PostgreSQL":
      query = `SELECT ordinal_position,column_name,udt_name AS data_type,numeric_precision,datetime_precision,numeric_scale,character_maximum_length AS data_length,is_nullable,column_name as check,column_name as check_constraint,column_default,column_name AS foreign_key,pg_catalog.col_description(pg_class.oid,ordinal_position) as comment FROM information_schema.columns JOIN pg_class ON information_schema.columns.table_name = pg_class.relname WHERE table_name='${item.name()}'AND table_schema='${item.schema()}';`;
      break;
    default:
      context.alert("Error", driver + " is not supported");
      return;
  }
  context.execute(query, res => {
    res.rows.sort((l, r) => {
      return (
        parseInt(l.raw("ordinal_position")) >
        parseInt(r.raw("ordinal_position"))
      );
    });
    
    res.rows.forEach(row => {
      let columnName = row.raw("column_name");
      let columnType = row.raw("data_type");
      let isNullable = row.raw("is_nullable");
      let defaultVal = row.raw("column_default");
      let extra = row.raw("extra");
      columnNames.push(columnName);
      columnTypes.push(columnType);
      isNullables.push(isNullable);
      defaultVals.push(defaultVal);
      extras.push(extra);
      columnComments.push(row.raw("comment"));
      dataLengths.push(row.raw("data_length"))
      numericPrecisions.push(row.raw("numeric_precision"))
      numericScales.push(row.raw("numeric_scale"))
    });
    
    var result = header;
    
    for (let i = 0; i < columnNames.length; i++) {
      var columnMigrate = getColumnPydantic(
        columnNames[i],
        columnTypes[i],
        isNullables[i],
        defaultVals[i],
        dataLengths[i],
        columnComments[i],
        numericPrecisions[i],
        numericScales[i]
      );
      result += `    ${columnMigrate}\n`;
    }
    result += `
#end
`;
    SystemService.insertToClipboard(result);
    SystemService.notify(
      "Pydantic Schema export",
      item.type() + " " + item.name() + " export statement is copied!"
    );
  });
}

export { dumpTableAsDefinition, dumpTableAsLaravel, dumpTableAsSQLAlchemyPG, dumpTableAsPydantic };
