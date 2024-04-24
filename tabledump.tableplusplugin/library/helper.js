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


function getColumnSQLAlchemyPG(columnName, dataType, isNullable, defaultVal, extra, columnComment) {
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
        migration = `${columnName} = Column(String(${typeLength})`;
      } else {
        migration = `${columnName} = Column(String`;
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
      migration = `${columnName} = Column(BigInteger`;
      break;
    case "char":
    case "bpchar":
      migration = `${columnName} = Column(String(${typeLength})`;
      break;
    case "enum":
      typeLength = typeLength.substring(0, typeLength.length - 1);
      migration = `${columnName} = Column(SQLAlchemyEnum('${typeLength}')`;
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
    case "timestamp":
      migration = `${columnName} = Column(DateTime`;
      break
    case "text":
      migration = `${columnName} = Column(Text`;
      break
    case "_varchar":
      migration = `${columnName} = Column(postgresql.ARRAY(String)`;
      break
    case "jsonb":
      migration = `${columnName} = Column(JSONB(none_as_null=True)`;
      break
    default:
      migration = `${columnName} = Column(${typeOnly}`;
      break;
  }

  if (dataType.includes("unsigned")) {
    //migration += "->unsigned()";
  }
  
  if (isNullable.toLowerCase().startsWith("no")) {
    migration += " ,nullable=False";
  }
  
  if (defaultVal) {
    if (defaultVal.toLowerCase().startsWith("nextval('")) {
        migration += " ,primary_key=True";
    } else {
        switch (typeOnly) {
            case "int2":
            case "int4":
            case "int8":
            case "bool":
                migration += " ,default=" + defaultVal + "";
                break;
            default:
                migration += " ,default='" + defaultVal + "'";
                break;
        }
    }
  }
  
  if (typeof columnComment != 'undefined' && columnComment) {
    migration += " ,comment='" + columnComment.trim() + "'";
  }

  return migration + ")";
}


function dumpTableAsSQLAlchemyPG(context, item) {
  var nameCamelcase = camelize(item.name());
  var header = `

from enum import Enum

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import JSONB

class ${nameCamelcase}(db_manager.Base):
    """
    Migration auto-generated by TablePlus ${Application.appVersion()}(${Application.appBuild()})

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
  var query;
  var driver = context.driver();
  switch (driver) {
    case "MySQL":
    case "MariaDB":
      query = `SELECT ordinal_position as ordinal_position,column_name as column_name,column_type AS data_type,is_nullable as is_nullable,column_default as column_default,extra as extra,column_name AS foreign_key,column_comment AS comment FROM information_schema.columns WHERE table_schema='${item.schema()}'AND table_name='${item.name()}';`;
      // break;
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
    });
    
    var result = header;
    
    for (let i = 0; i < columnNames.length; i++) {
      var columnMigrate = getColumnSQLAlchemyPG(
        columnNames[i],
        columnTypes[i],
        isNullables[i],
        defaultVals[i],
        extras[i],
        columnComments[i]
      );
      result += `    ${columnMigrate}\n`;
    }
    result += `
#end
`;
    SystemService.insertToClipboard(result);
    SystemService.notify(
      "SQLAlchemy export",
      item.type() + " " + item.name() + " export statement is copied!"
    );
  });
}

export { dumpTableAsDefinition, dumpTableAsLaravel, dumpTableAsSQLAlchemyPG };
