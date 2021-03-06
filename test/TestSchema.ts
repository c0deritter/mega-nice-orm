import { Schema } from '../src/Schema'

export class Object1 {
  id?: number
  property1?: string
  property2?: number
  object1Id?: number
  object2Id?: number

  manyObjects?: ManyObject[]
  object1?: Object1
  object2?: Object2
}

export class Object2 {
  id?: string
  property1?: string
  object1Id?: number|null
  
  object1?: Object1
  manyObjects?: ManyObject[]
}

export class ManyObject {
  object1Id?: number
  object2Id?: string
  property1?: string
  object1Id2?: number|null

  object1?: Object1
  object2?: Object2
  object12?: Object1
}

export const schema = {
  'table1': {
    columns: {
      'id': { property: 'id', id: true },
      'column1': 'property1',
      'column2': 'property2',
      'table1_id': 'object1Id',
      'table2_id': 'object2Id'
    },
    relationships: {
      manyObjects: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table_many',
        otherId: 'table1_id',
        delete: true
      },
      object1: {
        manyToOne: true,
        thisId: 'table1_id',
        otherTable: 'table1',
        otherId: 'id',
        otherRelationship: 'object1',
        delete: true
      },
      object2: {
        manyToOne: true,
        thisId: 'table2_id',
        otherTable: 'table2',
        otherId: 'id',
        otherRelationship: 'object1'
      }
    },
    rowToInstance: (row: any) => {
      let obj1 = new Object1
      obj1.id = row.id
      obj1.property1 = row.column1
      obj1.property2 = row.column2
      obj1.object1Id = row.table1_id
      obj1.object2Id = row.table2_id
      return obj1
    },
    instanceToRow: (obj1: Object1) => {
      return {
        id: obj1.id,
        column1: obj1.property1,
        column2: obj1.property2,
        table1_id: obj1.object1Id,
        table2_id: obj1.object2Id,
      }
    }
  },
  
  'table2': {
    columns: {
      'id': { property: 'id', id: true },
      'column1': 'property1',
      'table1_id': 'object1Id'
    },
    relationships: {
      object1: {
        manyToOne: true,
        thisId: 'table1_id',
        otherTable: 'table1',
        otherId: 'id',
        otherRelationship: 'object2'
      },
      manyObjects: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table_many',
        otherId: 'table2_id',
        delete: true
      }
    },
    rowToInstance: (row: any) => {
      let obj2 = new Object2
      obj2.id = row.id
      obj2.property1 = row.column1
      obj2.object1Id = row.table1_id
      return obj2      
    },
    instanceToRow: (obj2: Object2) => {
      return {
        id: obj2.id,
        column1: obj2.property1,
        table1_id: obj2.object1Id
      }
    }
  },

  'table_many': {
    columns: {
      'table1_id': { property: 'object1Id', id: true },
      'table2_id': { property: 'object2Id', id: true },
      'column1': 'property1',
      'table1_id2': 'object1Id2'
    },
    relationships: {
      object1: {
        manyToOne: true,
        thisId: 'table1_id',
        otherTable: 'table1',
        otherId: 'id'
      },
      object2: {
        manyToOne: true,
        thisId: 'table2_id',
        otherTable: 'table2',
        otherId: 'id'
      },
      object12: {
        manyToOne: true,
        thisId: 'table1_id2',
        otherTable: 'table1',
        otherId: 'id'
      }
    },
    rowToInstance: (row: any) => {
      let many = new ManyObject
      many.object1Id = row.table1_id
      many.object2Id = row.table2_id
      many.property1 = row.column1
      many.object1Id2 = row.table1_id2
      return many
    },
    instanceToRow: (many: ManyObject) => {
      return {
        table1_id: many.object1Id,
        table2_id: many.object2Id,
        column1: many.property1,
        table1_id2: many.object1Id2
      }
    }
  }
} as Schema