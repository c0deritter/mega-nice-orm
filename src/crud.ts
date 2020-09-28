import { ReadCriteria } from 'mega-nice-criteria'
import sql from 'mega-nice-sql'
import { fillReadCriteria, fillUpdateCriteria } from 'mega-nice-sql-criteria-filler'
import { instanceCriteriaToRowCriteria, instanceToDeleteCriteria, rowToUpdateCriteria } from './criteriaTools'
import { delete_ as isudDelete, insert } from './isud'
import { buildCountQuery, buildSelectQuery } from './queryTools'
import { allIdsSet, instanceToRow, rowToInstance, unjoinRows } from './rowTools'
import { Schema } from './Schema'
import { FiddledRows } from './util'

export async function create<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: T): Promise<T> {
  let row = instanceToRow(schema, tableName, instance)
  let insertedRow = await insert(schema, tableName, db, queryFn, row)
  let insertedInstance = rowToInstance(schema, tableName, insertedRow)
  return insertedInstance
}

export async function read<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: ReadCriteria): Promise<T[]> {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let rowCriteria = instanceCriteriaToRowCriteria(schema, tableName, criteria)

  let query = buildSelectQuery(schema, tableName, rowCriteria)

  let sqlString = query.sql(db)
  let values = query.values()

  // console.debug('sqlString', sqlString)
  // console.debug('values', values)

  let joinedRows = await queryFn(sqlString, values)
  let instances = unjoinRows(schema, tableName, joinedRows, criteria, true)

  return instances
}

export async function count<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: ReadCriteria): Promise<number> {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let rowCriteria = instanceCriteriaToRowCriteria(schema, tableName, criteria)

  let query = buildCountQuery(schema, tableName, rowCriteria)

  let sqlString = query.sql(db)
  let values = query.values()

  // console.debug('sqlString', sqlString)
  // console.debug('values', values)

  let rows = await queryFn(sqlString, values)

  return parseInt(rows[0].count)
}

export async function update<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: Partial<T>, alreadyUpdatedRows: FiddledRows = new FiddledRows(schema)): Promise<T> {
  // console.debug('Entering update...')
  // console.debug('instance', instance)
  // console.debug('alreadyUpdatedRows', alreadyUpdatedRows.fiddledRows)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let row = table.instanceToRow(instance)
  // console.debug('row', row)

  if (row == undefined) {
    throw new Error('Could not convert the given instance into a row')
  }

  if (alreadyUpdatedRows.containsRow(tableName, row)) {
    let alreadyUpdatedRow = alreadyUpdatedRows.getByRow(tableName, row)
    // console.debug('Row object was already inserted. Returning already updated row...', alreadyUpdatedRow)
    return alreadyUpdatedRow
  }

  let criteria = rowToUpdateCriteria(schema, tableName, row)
  // console.debug('criteria', criteria)

  let hasValuesToSet = false
  for (let column of Object.keys(criteria.set)) {
    if (criteria.set[column] !== undefined) {
      hasValuesToSet = true
      break
    }
  }

  let updatedRow = undefined

  if (hasValuesToSet) {
    // console.debug('There is something to set. Updating...')
    let query = sql.update(tableName)
    fillUpdateCriteria(query, criteria, Object.keys(table.columns))

    if (query._wheres.length > 0)

    if (db == 'postgres') {
      query.returning('*')
    }
  
    let sqlString = query.sql(db)
    let values = query.values()
  
    // console.debug('sqlString', sqlString)
    // console.debug('values', values)
  
    let updatedRows = await queryFn(sqlString, values)
    // console.debug('updatedRows', updatedRows)
  
    if (updatedRows.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }
  
    updatedRow = updatedRows[0]
    // console.debug('updatedRow', updatedRow)
  }
  else {
    // console.debug('No column to set given. Loading entity...')
    // remove the set property from the criteria to only have left the ids for selecting
    delete (criteria as any).set

    let query = sql.select('*').from(tableName)
    fillReadCriteria(query, criteria, Object.keys(table.columns))

    let sqlString = query.sql(db)
    let values = query.values()

    let selectedRows = await queryFn(sqlString, values)

    if (selectedRows.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }

    updatedRow = selectedRows[0]
  }

  let updatedInstance = table.rowToInstance(updatedRow)
  alreadyUpdatedRows.add(tableName, row, updatedInstance)

  // console.debug('Update relationships...')

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      // console.debug('relationshipName', relationshipName)
  
      if (typeof (instance as any)[relationshipName] == 'object' && (instance as any)[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          // console.debug('Many-to-one relationship')
          // console.debug('Updating. Going into recursion...')
          let updatedRelationshipInstance = await update(schema, relationship.otherTable, db, queryFn, (instance as any)[relationshipName], alreadyUpdatedRows)
          // console.debug('Coming back from recursion...')
          updatedInstance[relationshipName] = updatedRelationshipInstance
        }
        else if ((instance as any)[relationshipName] instanceof Array) {
          // console.debug('One-to-many relationship. Iterating through all relationhip rows...')
          updatedInstance[relationshipName] = []
  
          for (let relationshipInstance of (instance as any)[relationshipName]) {
            // console.debug('Updating. Going into recursion...')
            let updatedRelationshipInstance = await update(schema, relationship.otherTable, db, queryFn, relationshipInstance, alreadyUpdatedRows)
            // console.debug('Coming back from recursion...')            
            updatedInstance[relationshipName].push(updatedRelationshipInstance)
          }
        }
        else {
          // console.debug('Was neither a many-to-one relationship nor was the correspinding object of type Array')
        }
      }
      else {
        // console.debug('Relationship is not of type object or null. Continuing...')
      }
    }  
  }

  // console.debug('Returning updatedInstance...', updatedInstance)
  return updatedInstance
}

export async function delete_<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: T): Promise<T> {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let criteria = instanceToDeleteCriteria(schema, tableName, instance)
  let rowCriteria = instanceCriteriaToRowCriteria(schema, tableName, criteria)

  if (! allIdsSet(table, rowCriteria)) {
    throw new Error('Not all id\'s are set')
  }

  let deletedRows = await isudDelete(schema, tableName, db, queryFn, rowCriteria)

  if (deletedRows.length != 1) {
    throw new Error('Expected row count does not equal 1')
  }

  let deletedRow = deletedRows[0]
  let deletedInstance = rowToInstance(schema, tableName, deletedRow)
  return deletedInstance
}