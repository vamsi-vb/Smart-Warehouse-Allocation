 const cds = require("@sap/cds");
// import cds from "@sap/cds";

const { INSERT, SELECT, UPDATE } = cds.ql;

module.exports = async (srv) => {
  const { Items, Warehouses, WarehouseInventory, Salesorders } = srv.entities;

  async function deductStock(item, req) {
    const warehouse_ID = item.AllocatedWarehouse_ID || item.Allocatedwarehouse;
    if (!warehouse_ID) return;

    const inv = await SELECT.one
      .from(WarehouseInventory)
      .where({
        warehouse_ID: warehouse_ID,
        ProductId: item.ProductId,
      });

    if (!inv || inv.StockQuantity < item.quantity) {
      const wh = await SELECT.one
        .from(Warehouses)
        .where({ ID: warehouse_ID });
      req.error(
        400,
        `Insufficient stock in warehouse ${wh?.WarehouseName || warehouse_ID} for product ${item.ProductId}`,
      );
      return;
    }

    const newStockQuantity = inv.StockQuantity - item.quantity;
    await UPDATE(WarehouseInventory)
      .set({ StockQuantity: newStockQuantity })
      .where({ ID: inv.ID });

    if (newStockQuantity < 5) {
      await reStock({
        AllocatedWarehouse_ID: warehouse_ID,
        ProductId: item.ProductId,
        quantity: 10 // default restock quantity
      }, req);
    }
  }

  async function reStock(item, req) {
    const warehouse_ID = item.AllocatedWarehouse_ID || item.Allocatedwarehouse_ID;
    if (!warehouse_ID) return;

    const inv = await SELECT.one
      .from(WarehouseInventory)
      .where({
        warehouse_ID: warehouse_ID,
        ProductId: item.ProductId,
      });

    if (!inv) {
      req.reject(404, `No inventory found for product ${item.ProductId} in warehouse ${warehouse_ID}`);
      return;
    }

    await UPDATE(WarehouseInventory)
      .set({
        StockQuantity: inv.StockQuantity + item.quantity,
        numberOfTimesRestocked: (inv.numberOfTimesRestocked || 0) + 1
      })
      .where({ ID: inv.ID });
  }

  srv.before("CREATE", "SalesOrders", async (req) => {
    const { CustomerName, CustomerEmail, CustomerLatitude, CustomerLongitude } =
      req.data;

    if (
      !CustomerName ||
      !CustomerEmail ||
      CustomerLatitude == null ||
      CustomerLongitude == null
    ) {
      return req.reject(
        400,
        "customer details are required to create an order",
      );
    }

    if (!req.data.OrderNumber) {
      req.data.OrderNumber = Math.floor(Math.random() * 100) + 1;
    }
    
    if (!req.data.ID) {
      req.data.ID = cds.utils.uuid();
    }

    if (req.data.item && req.data.item.length > 0) {
      const items = req.data.item;
      for (let item of items) {
        if (!item.quantity || item.quantity <= 0) {
          return req.error(400, `Quantity must be greater than 0 for product ${item.ProductId}`);
        }
      }
      let warehouseFulfillment = {};
      
      for (let item of items) {
        const winvs = await SELECT.from(WarehouseInventory).where({ProductId: item.ProductId, StockQuantity: {'>=': item.quantity}});
        for (let winv of winvs) {
          const wId = winv.warehouse_ID || winv.warehouse_Id;
          if (!wId) continue;
          if (!warehouseFulfillment[wId]) {
            const wh = await SELECT.one.from(Warehouses).where({ID: wId, status: 'Active'});
            if (wh) {
              const dist = await calculateDistance(CustomerLatitude, CustomerLongitude, wh.Latitude, wh.Longitude);
              warehouseFulfillment[wId] = { warehouse: wh, fulfilledItems: [], distance: dist };
            }
          }
          if (warehouseFulfillment[wId]) {
            warehouseFulfillment[wId].fulfilledItems.push(item);
          }
        }
      }
      
      let whArray = Object.values(warehouseFulfillment);
      if (whArray.length > 0) {
        whArray.sort((a, b) => {
          if (b.fulfilledItems.length !== a.fulfilledItems.length) {
             return b.fulfilledItems.length - a.fulfilledItems.length;
          }
          return a.distance - b.distance;
        });
        
        let bestWarehouseData = whArray[0];
        let primaryWarehouse = bestWarehouseData.warehouse;
        let fulfilledProductIds = bestWarehouseData.fulfilledItems.map(i => i.ProductId);
        
        for (let item of items) {
          item.AllocatedWarehouse_ID = primaryWarehouse.ID;
          
          if (!fulfilledProductIds.includes(item.ProductId)) {
            let bestOtherWh = null;
            let minDist = Infinity;
            const otherWinvs = await SELECT.from(WarehouseInventory).where({ProductId: item.ProductId, StockQuantity: {'>=': item.quantity}});
            
            for (let winv of otherWinvs) {
              const otherWId = winv.warehouse_ID || winv.warehouse_Id;
              if (otherWId === primaryWarehouse.ID || !otherWId) continue;
              const otherWh = await SELECT.one.from(Warehouses).where({ID: otherWId, status: 'Active'});
              if (otherWh) {
                 const dist = await calculateDistance(primaryWarehouse.Latitude, primaryWarehouse.Longitude, otherWh.Latitude, otherWh.Longitude);
                 if (dist < minDist) {
                    minDist = dist;
                    bestOtherWh = otherWh;
                 }
              }
            }
            
            if (bestOtherWh) {
               await INSERT.into('swa.AccountingBooks').entries({
                  ID: cds.utils.uuid(),
                  RequestingWarehouse_ID: primaryWarehouse.ID,
                  SupplyingWarehouse_ID: bestOtherWh.ID,
                  ProductId: item.ProductId,
                  quantity: item.quantity,
                  SalesOrder_ID: req.data.ID
               });
               
               let invA = await SELECT.one.from(WarehouseInventory).where({warehouse_ID: primaryWarehouse.ID, ProductId: item.ProductId});
               if (invA) {
                  await UPDATE(WarehouseInventory).set({StockQuantity: invA.StockQuantity + item.quantity}).where({ID: invA.ID});
               } else {
                  await INSERT.into(WarehouseInventory).entries({
                     ID: cds.utils.uuid(),
                     warehouse_ID: primaryWarehouse.ID,
                     ProductId: item.ProductId,
                     StockQuantity: item.quantity
                  });
               }
               
               let invB = await SELECT.one.from(WarehouseInventory).where({warehouse_ID: bestOtherWh.ID, ProductId: item.ProductId});
               if (invB) {
                  await UPDATE(WarehouseInventory).set({StockQuantity: invB.StockQuantity - item.quantity}).where({ID: invB.ID});
               }
            } else {
               return req.error(400, `Insufficient stock globally for product ${item.ProductId}`);
            }
          }
        }
      } else {
         return req.error(400, `Could not fulfill the order. No warehouse has stock for any of the items.`);
      }
    }
  });

  async function calculateDistance(lat1, log1, lat2, log2) {
     let R = 6371;
     const dlat = (lat2 - lat1) * Math.PI / 180;
     const dlog = (log2 - log1) * Math.PI / 180;
     const a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1 * Math.PI /180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlog/2) * Math.sin(dlog/2);

     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
     return R * c;
  }   

  async function getBestWareHouse(ProductId, quantity, CusLatitude, CusLongitude) {
     
    const winvs = await SELECT.from(WarehouseInventory).where({ProductId: ProductId, StockQuantity: {'>=': quantity}});
    if(!winvs){
      return req.reject(404, "product did not have enough stock in warehouse inventory");
    }
     
    
    const wids = winvs.map((winv) => winv.warehouse_Id);
    const warehouses = await SELECT.from(Warehouses).where({ID: {in: wids}, status: 'active'})

    if(!warehouses){
      return null;
    }

    let best = null;
    let mindist = Infinity;
    for(let wh of warehouses) {
     const dist = calculateDistance(CusLatitude, CusLongitude, wh.Latitude, wh.Longitude);
     if(dist < mindist) {
      mindist = dist;
      best = wh;
     }
    }
    return best;
  }
   // write a function that queries most sold warehouse based on more number of restock for specific products and total value sold 



  async function validateStock(warehouse_Id, Product_ID, quantity, req) {
      
    const inv = await SELECT.one.from(WarehouseInventory).where({warehouse_Id: warehouse_Id, productID: Product_ID});
     
   if(inv.StockQuantity < quantity) {
     const wh = await SELECT.one.from(Warehouses).where({ID: warehouse_Id});
     return `there isn't enough stock for this product in warehouse ${wh.WarehouseName}`;
   }
   
  };

  srv.before("DELETE", "SalesOrders", async (req) => {
    const orderId = req.data.ID;

    if (!orderId) return;

    const items = await SELECT.from(Items).where({ parent_ID: orderId });
    for (let item of items) {
      // await releaseItem.call(item, req); // releaseItem is not defined yet
    }
  });


  /*
  async function validateAllocation(warehouse_Id, productID, Quantity, req) {
    const wh = await SELECT.one.from(Warehouses).where({ ID: warehouse_Id });
    if (!wh) {
      req.error(404, "warehouse is not allocated to this");
    }
    if (wh.staus !== "active") {
      req.error(
        400,
        `allocated warehouse ${wh.WarehouseName} is not operational`,
      );
    }

    const inv = await SELECT.from(WarehouseInventory).where({
      ID: warehouse_Id,
      ProductID: productID,
    });
    if (inv.StockQuantity < Quantity) {
      req.error(
        400,
        `quantity not sufficient in inventory ${wh.ID} of product ${productID}`,
      );
    }
  }
  */

  srv.after("CREATE", "Items", async (data, req) => {
    if (data.AllocatedWarehouse_ID) {
      await validateAllocation(
        data.AllocatedWarehouse_ID,
        data.ProductID,
        data.Quantity,
      );
      await deductStock(data, req);
      return;
    }
    const order = await SELECT.from('SalesOrders')
      .columns(['CustomerLongitude', 'CustomerLatitude'])
      .where({ ID: data.parent_ID });
    if (
      !order ||
      (order.CustomerLatitude && order.CustomerLongitude === null)
    ) {
      req.error();
    }

    const wInv = await SELECT.one
      .from(WarehouseInventory)
      .where({ ID: data.productID });
  });

  srv.on('CREATE', 'AccountingBooks', async(req) => {
      const interWarehouseOrder = req.data;

      //

      return interWarehouseOrder;
  });
  srv.on('getDistanceForItem', async (req) => {
    const { itemID } = req.data;
    if (!itemID) return req.reject(400, "itemID is required");

    const ItemsDrafts = srv.entities.Items.drafts;
    const SalesOrdersDrafts = srv.entities.SalesOrders.drafts;

    // Fetch the Item to get its parent SalesOrder and AllocatedWarehouse
    let item = await SELECT.one.from(srv.entities.Items).where({ ID: itemID });
    if (!item && ItemsDrafts) {
       item = await SELECT.one.from(ItemsDrafts).where({ ID: itemID });
    }
    
    if (!item || !item.parent_ID || !item.AllocatedWarehouse_ID) {
      return req.reject(400, "Item, parent SalesOrder, or AllocatedWarehouse missing");
    }

    let order = await SELECT.one.from(srv.entities.SalesOrders).where({ ID: item.parent_ID });
    if (!order && SalesOrdersDrafts) {
       order = await SELECT.one.from(SalesOrdersDrafts).where({ ID: item.parent_ID });
    }
    
    const wh = await SELECT.one.from(srv.entities.Warehouses).where({ ID: item.AllocatedWarehouse_ID });

    if (!order || !wh || order.CustomerLatitude == null || order.CustomerLongitude == null || wh.Latitude == null || wh.Longitude == null) {
      return req.reject(400, "Coordinates missing in database for this item");
    }

    return await calculateDistance(order.CustomerLatitude, order.CustomerLongitude, wh.Latitude, wh.Longitude);
  });

  srv.on('getTopPerformingWarehouse', async (req) => {
    const warehouses = await SELECT.from(Warehouses).where({ status: 'Active' });
    if (!warehouses || warehouses.length === 0) return null;

    let bestWarehouse = null;
    let maxScore = -1;

    for (let wh of warehouses) {
      const items = await SELECT.from(Items).where({ AllocatedWarehouse_ID: wh.ID });
      let totalAmountSold = 0;
      if (items && items.length > 0) {
        totalAmountSold = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.UnitPrice || 0)), 0);
      }
      const inventories = await SELECT.from(WarehouseInventory).where({ warehouse_ID: wh.ID });
      let totalRestocks = 0;
      if (inventories && inventories.length > 0) {
        totalRestocks = inventories.reduce((sum, inv) => sum + (inv.numberOfTimesRestocked || 0), 0);
      }
      // Calculate demand velocity by multiplying revenue by restock frequency
      const score = totalAmountSold * (1 + totalRestocks);
      if (score > maxScore) {
        maxScore = score;
        bestWarehouse = wh;
      }
    }
    return bestWarehouse;
  })

  srv.on('getBestWarehouseForOrder', async (req) => {
    const { salesOrderId } = req.data;
    if (!salesOrderId) return req.reject(400, "salesOrderId is required");

    const order = await SELECT.one.from('SalesOrders').where({ ID: salesOrderId });
    if (!order) return req.reject(404, "Order not found");

    const items = await SELECT.from(Items).where({ parent_ID: salesOrderId });
    if (!items || items.length === 0) return req.reject(400, "Order has no items");

    let warehouseFulfillment = {};
    
    for (let item of items) {
      const winvs = await SELECT.from(WarehouseInventory).where({ProductId: item.ProductId, StockQuantity: {'>=': item.quantity || 1}});
      for (let winv of winvs) {
        const wId = winv.warehouse_ID || winv.warehouse_Id;
        if (!wId) continue;
        
        if (!warehouseFulfillment[wId]) {
          const wh = await SELECT.one.from(Warehouses).where({ID: wId, status: 'Active'});
          if (wh) {
            const dist = await calculateDistance(order.CustomerLatitude, order.CustomerLongitude, wh.Latitude, wh.Longitude);
            warehouseFulfillment[wId] = { warehouse: wh, fulfilledItems: [], distance: dist };
          }
        }
        
        if (warehouseFulfillment[wId]) {
          warehouseFulfillment[wId].fulfilledItems.push(item);
        }
      }
    }

    let whArray = Object.values(warehouseFulfillment);
    if (whArray.length === 0) {
      return req.reject(404, "No active warehouse found with stock for any of the items.");
    }

    whArray.sort((a, b) => {
      if (b.fulfilledItems.length !== a.fulfilledItems.length) {
         return b.fulfilledItems.length - a.fulfilledItems.length;
      }
      return a.distance - b.distance;
    });

    const bestWarehouse = whArray[0].warehouse;
    
    // Update the AllocatedWarehouse_ID for all items in the order
    for (let item of items) {
       await UPDATE(Items).set({ AllocatedWarehouse_ID: bestWarehouse.ID }).where({ ID: item.ID });
    }

    return bestWarehouse;

      // return whArray[0]
  });
  srv.after('READ', 'SalesOrders', async (data, req) => {
    if (!data) return;
    const orders = Array.isArray(data) ? data : [data];
    if (orders.length === 0) return;

    const orderIds = orders.map(o => o.ID).filter(id => id);
    if (orderIds.length === 0) return;

    const items = await SELECT.from(Items).where({ parent_ID: { in: orderIds } });
    const itemMap = {};
    for (let item of items) {
       if (!itemMap[item.parent_ID]) itemMap[item.parent_ID] = { allocated: 0, notAllocated: 0 };
       if (item.AllocatedWarehouse_ID || item.AllocatedWarehouse_Id) {
          itemMap[item.parent_ID].allocated++;
       } else {
          itemMap[item.parent_ID].notAllocated++;
       }
    }

    for (let order of orders) {
      const counts = itemMap[order.ID] || { allocated: 0, notAllocated: 0 };
      order.AllocatedItems = counts.allocated;
      order.NotAllocatedItems = counts.notAllocated;

      // Criticality: 3 = Green, 1 = Red, 2 = Yellow, 0 = Neutral
      order.AllocatedCritical = counts.allocated > 0 ? 3 : (counts.notAllocated > 0 ? 1 : 0);
      order.NotAllocatedCritical = counts.notAllocated > 0 ? 1 : 3;
    }
  });

};
