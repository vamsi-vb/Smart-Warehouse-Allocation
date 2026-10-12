sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], function(MessageToast, MessageBox, JSONModel) {
    "use strict";

    return {
        onInit: function(oEvent) {
            // FPM extensions might not have onInit depending on how they are attached.
            // Using a routing or binding change listener is usually better.
        },
        
        onModelContextChange: function(oEvent) {
            var oVBox = oEvent.getSource();
            var oContext = oVBox.getBindingContext();
            
            if (!oContext) return;
            
            var sPath = oContext.getPath();
            if (oVBox._sCurrentContextPath === sPath) {
                return; // already processed this context
            }
            oVBox._sCurrentContextPath = sPath;

            var oMetricsModel = oVBox.getModel("metrics");
            if (!oMetricsModel) {
                oMetricsModel = new JSONModel({
                    totalQuantity: 0,
                    itemCount: 0,
                    averageQuantity: 0
                });
                oVBox.setModel(oMetricsModel, "metrics");
            }
            
            oContext.requestObject("item").then(function(aItems) {
                if (aItems && aItems.length > 0) {
                    var iTotal = aItems.reduce(function(sum, item) {
                        return sum + (item.quantity || 0);
                    }, 0);
                    oMetricsModel.setProperty("/totalQuantity", iTotal);
                    oMetricsModel.setProperty("/itemCount", aItems.length);
                    oMetricsModel.setProperty("/averageQuantity", (iTotal / aItems.length).toFixed(2));
                } else {
                    oMetricsModel.setProperty("/totalQuantity", 0);
                    oMetricsModel.setProperty("/itemCount", 0);
                    oMetricsModel.setProperty("/averageQuantity", 0);
                }
            });
        },


        onAllocate: function(oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                MessageToast.show("No context found.");
                return;
            }

             var sSalesOrderId = oContext.getProperty("ID");
            var oModel = oContext.getModel();
            
            var oAction = oModel.bindContext("/getBestWarehouseForOrder(...)");
            oAction.setParameter("salesOrderId", sSalesOrderId);

            oAction.execute().then(function() {
                var oResult = oAction.getBoundContext().getObject(); //know what data the backend action returns
                if (oResult && oResult.ID) {
                    MessageToast.show("Allocated Warehouse: " + oResult.WarehouseName);
                } else {
                    MessageToast.show("Allocation completed.");
                }
                // oContext.refresh();
            }).catch(function(oError) {
                MessageBox.error("Error during allocation: " + oError.message);
            });
        }
    };
});
