using {swa} from '../db/schema.cds';

 //using { Capabilities } from '@sap/cds/common';


service CatalogService @(requires: 'authenticated-user') {
   @odata.draft.enabled
   @restrict: [
       { grant: '*', to: 'admin' },
       { grant: '*', to: 'user', where: 'createdBy = $user' }

   ]
   entity SalesOrders as projection on swa.SalesOrders {
       *,
       virtual null as NotAllocatedItems: Integer,
       virtual null as AllocatedItems: Integer,
       virtual null as NotAllocatedCritical: Integer,
       virtual null as AllocatedCritical: Integer
   };

   @restrict: [
       { grant: '*', to: 'admin' },
       { grant: '*', to: 'user', where: 'createdBy = $user' }
   ]
   entity Items as projection on swa.Items {
       *,
       parent.CustomerName as CustomerName,
       parent.OrderNumber as OrderNumber
   };

    


   @odata.draft.enabled
   entity Warehouses as projection on swa.Warehouses;


   entity WarehouseInventory as projection on swa.WarehouseInventory;

   
   


   entity AccountingBooks as projection on swa.AccountingBooks;
   
   function getTopPerformingWarehouse() returns Warehouses;
   
   action getBestWarehouseForOrder(salesOrderId: UUID) returns Warehouses;
   
   function getDistanceForItem(itemID: UUID) returns Decimal;
   

}
 


 annotate swa.WarehouseInventory with @(
    Capabilities.InsertRestrictions.Insertable: false,
    Capabilities.UpdateRestrictions.Updatable: false,
    Capabilities.DeleteRestrictions.Deletable: false
 );
 
 annotate swa.Warehouses with @(
    Capabilities.FilterRestrictions: {
        Filterable: true,
        NonFilterableProperties: [
            'Id', 'Created_at', 'Created_by'
        ]
    },
    Capabilities.SortRestrictions: {
        Sortable: true
    },

    Capabilities.SearchRestrictions: {
       Searchable: true
    }
 );
 



  annotate CatalogService.Items with {
    AllocatedWarehouse @(
        Common.Text: AllocatedWarehouse.WarehouseName,
        Common.TextArrangement: #TextFirst,
        Common.ValueListWithFixedValues: true,
        Common.ValueList: {
            CollectionPath: 'Warehouses',
            Parameters: [
                {$Type: 'Common.ValueListParameterInOut', LocalDataProperty: AllocatedWarehouse_ID, ValueListProperty: 'ID'},
                {$Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'WarehouseName'}
            ]
        }
    );
 }
 













