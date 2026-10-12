sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (JSONModel, MessageToast, MessageBox) {
    "use strict";

    return sap.ui.controller("smart.warehouse.fe.v2.ext.controller.ObjectPageExt", {
        onInit: function () {
            this.extensionAPI.attachPageDataLoaded(this.onPageDataLoaded.bind(this));
            var oMetricsModel = new JSONModel({
                totalQuantity: 0,
                itemCount: 0,
                averageQuantity: 0,
                isFullyAllocated: false
            });
            this.getView().setModel(oMetricsModel, "metricsModel");
        },

        onPageDataLoaded: function (oEvent) {
            var oContext = oEvent.context;
            if (!oContext) return;

            var sPath = oContext.getPath();
            var oModel = this.getView().getModel();
            var oMetricsModel = this.getView().getModel("metricsModel");

            // Fetch items for metrics
            oModel.read(sPath + "/item", {
                success: function (oData) {
                    var aItems = oData.results || [];
                    if (aItems.length > 0) {
                        var totalQty = 0;
                        var isFullyAllocated = true;
                        aItems.forEach(function (item) {
                            totalQty += (item.quantity || 0);
                            if (!item.AllocatedWarehouse_ID) {
                                isFullyAllocated = false;
                            }
                        });
                        oMetricsModel.setProperty("/itemCount", aItems.length);
                        oMetricsModel.setProperty("/totalQuantity", totalQty);
                        oMetricsModel.setProperty("/averageQuantity", (totalQty / aItems.length).toFixed(2));
                        oMetricsModel.setProperty("/isFullyAllocated", isFullyAllocated);
                    } else {
                        oMetricsModel.setProperty("/itemCount", 0);
                        oMetricsModel.setProperty("/totalQuantity", 0);
                        oMetricsModel.setProperty("/averageQuantity", 0);
                        oMetricsModel.setProperty("/isFullyAllocated", false);
                    }
                },
                error: function (err) {
                    console.error("Failed to read items for metrics", err);
                }
            });
        },

        onAllocateWarehouse: function (oEvent) {
            var oMetricsModel = this.getView().getModel("metricsModel");
            if (oMetricsModel.getProperty("/isFullyAllocated")) {
                MessageBox.information("Warehouse already allocated");
                return;
            }

            var oContext = this.getView().getBindingContext();
            if (!oContext) return;

            var sOrderId = oContext.getProperty("ID");
            if (!sOrderId) {
                MessageToast.show("Order ID not found.");
                return;
            }

            var oModel = this.getView().getModel();
            sap.ui.core.BusyIndicator.show(0);

            oModel.callFunction("/getBestWarehouseForOrder", {
                method: "POST",
                urlParameters: {
                    salesOrderId: sOrderId
                },
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide();
                    var oResult = oData.getBestWarehouseForOrder;
                    if (oResult) {
                        MessageToast.show("Successfully allocated to " + oResult.WarehouseName);
                    } else {
                        MessageToast.show("Allocation completed.");
                    }
                    oModel.refresh(true);
                },
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    var sMessage = "Allocation failed";
                    try {
                        var oResponse = JSON.parse(oError.responseText);
                        if (oResponse && oResponse.error && oResponse.error.message) {
                            sMessage = oResponse.error.message.value;
                        }
                    } catch (e) {
                        // ignore
                    }
                    MessageBox.error(sMessage);
                }
            });
        }
    });
});
