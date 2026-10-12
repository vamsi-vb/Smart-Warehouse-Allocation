sap.ui.define(
  ["sap/m/MessageBox", "sap/ui/model/json/JSONModel"],
  function (MessageBox, JSONModel) {
    "use strict";

    return {
      onModelContextChange: function (oEvent) {
        var oVBox = oEvent.getSource();
        var oModel = oVBox.getModel();

        if (!oModel || oVBox._bDataFetched) return;

        oVBox._bDataFetched = true;

        var oTopWarehouseModel = new JSONModel({
          WarehouseName: "Loading...",
        });
        oVBox.setModel(oTopWarehouseModel, "topWarehouse");

        var oAction = oModel.bindContext("/getTopPerformingWarehouse(...)"); // prepares for a function call
        oAction
          .execute()
          .then(function () {
            var oResult = oAction.getBoundContext().getObject();
            if (oResult) {
              oTopWarehouseModel.setProperty(
                "/WarehouseName",
                oResult.WarehouseName,
              );
            } else {
              oTopWarehouseModel.setProperty("/WarehouseName", "N/A");
            }
          })
          .catch(function (oError) {
            MessageBox.error("Error fetching top warehouse: " + oError.message);
          });
      },
      onCloseDialog: function (oEvent) {
        oEvent.getSource().getParent().close();
      },
    };
  },
);
