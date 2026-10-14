/* Sterling Motors Phase 3: deterministic, read-only workflow checks.
   Do not mutate financial, service or vehicle status from these helpers. */
export function dealReadiness({deal={}, finance=null, delivery=null, vehicle=null}={}) {
  const checks=[
    {key:"customer",label:"Customer linked",ok:!!deal.customerId},
    {key:"vehicle",label:"Vehicle linked",ok:!!deal.vehicleId},
    {key:"approval",label:"Sales approval recorded",ok:!!(deal.managerApprovedAt||deal.approvedAt||deal.managerApprovalStatus==="approved"||deal.stage==="finance"||deal.stage==="delivery"||deal.stage==="complete")},
    {key:"finance",label:"Finance disposition complete",ok:!!(deal.financeStatus==="approved"||deal.paymentType==="cash"||deal.financeType==="cash"||finance?.status==="approved")},
    {key:"delivery",label:"Delivery record linked",ok:!!(deal.deliveryId||delivery?.id)},
    {key:"vehicleStatus",label:"Vehicle not marked unavailable",ok:!vehicle||!["repossessed","scrapped"].includes(vehicle.status)}
  ];
  return {ready:checks.every(x=>x.ok),checks,missing:checks.filter(x=>!x.ok).map(x=>x.label)};
}
export function repairOrderReadiness({order={},partsRequests=[]}={}) {
  const blocked=partsRequests.filter(x=>x.repairOrderId===order.id && ["requested","backordered"].includes(x.status||"requested"));
  const checks=[
    {key:"customer",label:"Customer linked",ok:!!order.customerId},
    {key:"vehicle",label:"Vehicle identified",ok:!!(order.vehicleId||order.vehicleName)},
    {key:"estimate",label:"Estimate present",ok:Number.isFinite(Number(order.estimateTotal))&&Number(order.estimateTotal)>=0},
    {key:"parts",label:"No outstanding parts requests",ok:blocked.length===0},
    {key:"authorization",label:"Customer authorization recorded",ok:!!(order.authorizedAt||order.customerAuthorizedAt||order.authorizationStatus==="approved")}
  ];
  return {ready:checks.every(x=>x.ok),checks,missing:checks.filter(x=>!x.ok).map(x=>x.label)};
}
export function motorsWorkflowSummary({deals=[],repairOrders=[],financeApplications=[],deliveries=[],vehicles=[],partRequests=[]}={}){
  const byId=arr=>new Map(arr.map(x=>[x.id,x]));
  const finances=byId(financeApplications), deliveryMap=byId(deliveries), stock=byId(vehicles);
  const dealReviews=deals.filter(x=>!["complete","lost","cancelled"].includes(x.stage)).map(deal=>({
    id:deal.id,label:deal.dealNumber||deal.customerName||"Deal",
    ...dealReadiness({deal,finance:finances.get(deal.financeApplicationId),delivery:deliveryMap.get(deal.deliveryId),vehicle:stock.get(deal.vehicleId)})
  }));
  const serviceReviews=repairOrders.filter(x=>!["closed","cancelled"].includes(x.status)).map(order=>({
    id:order.id,label:order.roNumber||order.customerName||"Repair order",
    ...repairOrderReadiness({order,partsRequests:partRequests})
  }));
  return {dealReviews,serviceReviews,
    dealsBlocked:dealReviews.filter(x=>!x.ready).length,
    serviceBlocked:serviceReviews.filter(x=>!x.ready).length};
}
