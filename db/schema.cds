namespace swa;

aspect auditfields {
   created_at : DateTime;
   createdBy : String @cds.on.insert: $user;
}


type status: String enum {
      Active;
      Inactive;
}


entity SalesOrders : auditfields {
   key ID                : UUID;
       OrderNumber       : String;
       CustomerName      : String;
       CustomerEmail     : String;
       CustomerLatitude  : Decimal(7,4);
       CustomerLongitude : Decimal(7,4);
       item              : Composition of many Items on item.parent = $self;
}


entity Items : auditfields {
   key ID         : UUID;
       ProductId  : String;
       ProductName : String;
       quantity   : Integer;
       UnitPrice  : Integer;
       parent: Association to one SalesOrders;
       AllocatedWarehouse: Association to one Warehouses;
}

entity Warehouses : auditfields {
   key ID       : UUID;
   WarehouseName: String;
   Latitude: Decimal(7,4);
   Longitude: Decimal(7,4);
   Inventory: Composition of many WarehouseInventory on Inventory.warehouse = $self;
   status: status;
}

entity WarehouseInventory: auditfields{
  key ID: UUID;
  ProductId: String;
  StockQuantity: Integer;
  warehouse: Association to one Warehouses; 
  numberOfTimesRestocked: Integer;
}

entity AccountingBooks : auditfields {
   key ID : UUID;
   RequestingWarehouse : Association to Warehouses;
   SupplyingWarehouse : Association to Warehouses;
   ProductId : String;
   quantity : Integer;
   SalesOrder : Association to SalesOrders;
}
   