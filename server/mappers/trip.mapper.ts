export function mapTripToFrontend(trip: any) {
  if (!trip) return trip;
  const mapped = { ...trip };

  if (mapped.destination && mapped.destination.name) {
    mapped.destination = mapped.destination.name;
  }

  mapped.shareCode = mapped.invitationToken;
  mapped.sharePermission = mapped.sharePermission || "viewer";
  mapped.isShared = !!mapped.invitationToken;

  if (mapped.ownerId) {
    mapped.userId = mapped.ownerId.toString();
  }
  if (mapped.owner) {
    mapped.ownerName = mapped.owner.fullName || mapped.owner.userName;
  }

  if (mapped.expenses && Array.isArray(mapped.expenses)) {
    mapped.expenses = mapped.expenses.map((e: any) => ({
      ...e,
      id: (e.expenseId || "").toString(),
      title: e.description || e.title || "",
      amount: Number(e.amount || 0),
      date: e.expenseDate || e.date || "",
      category: e.expenseType ? e.expenseType.name : "Khác",
      payer: e.paidByInfo ? e.paidByInfo.fullName || e.paidByInfo.userName : "Không rõ",
      paidByUserId: e.paidByInfo ? e.paidByInfo.userId.toString() : undefined,
      splitType: e.splitMethod || "none",
      activityId: e.itemId ? e.itemId.toString() : undefined,
      splits: e.splits
        ? e.splits.map((s: any) => ({
            userId: s.userId?.toString() || "",
            userName: s.user ? s.user.fullName || s.user.userName : "",
            amount: Number(s.amount || 0),
          }))
        : [],
    }));
  }

  if (mapped.members && Array.isArray(mapped.members)) {
    mapped.companions = mapped.members.map((m: any) => ({
      userId: (m.userId || "").toString(),
      userName: m.user ? m.user.fullName || m.user.userName : "",
      role: m.role || "member",
    }));

    if (mapped.owner) {
      const ownerIdStr = mapped.owner.userId.toString();
      const isOwnerInCompanions = mapped.companions.some((c: any) => c.userId === ownerIdStr);
      if (!isOwnerInCompanions) {
        mapped.companions.unshift({
          userId: ownerIdStr,
          userName: mapped.owner.fullName || mapped.owner.userName,
          role: "owner",
          isOwner: true,
        });
      } else {
        mapped.companions = mapped.companions.map((c: any) =>
          c.userId === ownerIdStr ? { ...c, isOwner: true, role: "owner" } : c,
        );
      }
    }
  } else if (mapped.owner) {
    mapped.companions = [
      {
        userId: mapped.owner.userId.toString(),
        userName: mapped.owner.fullName || mapped.owner.userName,
        role: "owner",
        isOwner: true,
      },
    ];
  }

  if (mapped.expenses && Array.isArray(mapped.expenses)) {
    const typeInverseMap: Record<string, string> = {
      "Di chuyển": "transport",
      "Mua sắm": "shopping",
      "Ăn uống": "food",
      "Tham quan": "sightseeing",
      Khác: "other",
    };

    mapped.expenses = mapped.expenses.map((e: any) => {
      const payerName = e.paidByInfo
        ? e.paidByInfo.fullName || e.paidByInfo.userName
        : e.payer || "Không rõ";
      const rawType = e.expenseType ? e.expenseType.name : "Khác";
      return {
        ...e,
        id: (e.expenseId || "").toString(),
        title: e.description || e.title || "",
        amount: Number(e.amount || 0),
        date: e.expenseDate || e.date || "",
        type: typeInverseMap[rawType] || "other",
        payer: payerName,
        paidBy: payerName,
        paidByUserId: e.paidByInfo ? e.paidByInfo.userId.toString() : e.paidBy?.toString(),
        splitType: e.splitMethod || "none",
        activityId: e.itemId ? e.itemId.toString() : undefined,
        splits: e.splits
          ? e.splits.map((s: any) => {
              let uName = s.user ? s.user.fullName || s.user.userName : "";
              if (!uName && mapped.companions) {
                const comp = mapped.companions.find((c: any) => c.userId === s.userId?.toString());
                if (comp) uName = comp.userName;
              }
              return {
                userId: s.userId?.toString() || "",
                userName: uName,
                amount: Number(s.amount || 0),
              };
            })
          : [],
      };
    });
  }

  const activitiesWithExpenses = new Map<string, any>();
  if (mapped.expenses) {
    mapped.expenses.forEach((e: any) => {
      if (e.activityId) {
        activitiesWithExpenses.set(e.activityId, e);
      }
    });
  }

  let totalActivityCost = 0;
  if (mapped.days && Array.isArray(mapped.days)) {
    const sortedDays = [...mapped.days].sort((a, b) => (a.dayIndex || 0) - (b.dayIndex || 0));

    mapped.days = sortedDays.map((day: any) => ({
      ...day,
      day: day.dayIndex,
      title: day.title || `Ngày ${day.dayIndex}`,
      activities: day.items
        ? [...day.items]
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .map((item: any) => {
              const itemIdStr = item.itemId.toString();
              const linkedExp = activitiesWithExpenses.get(itemIdStr);
              const actualCost = item.actualCost ? Number(item.actualCost) : 0;
              totalActivityCost += actualCost;

              const poi = item.poi;
              return {
                ...item,
                id: item.itemId,
                title: item.customName,
                time: item.startTime,
                description: poi ? poi.description : undefined,
                note: item.note || undefined,
                notes: item.note ? [item.note] : undefined,
                estimatedCost: item.estimatedCost
                  ? Number(item.estimatedCost)
                  : poi?.estimatedCost
                    ? Number(poi.estimatedCost)
                    : 0,
                actualCost,
                paidBy: linkedExp ? linkedExp.payer : undefined,
                paidByUserId: linkedExp ? linkedExp.paidByUserId : undefined,
                isCompleted: item.status === "completed",
                expenseTypeId: item.expenseTypeId,
                activityType: (item as any).placeType || item.activityType,
                address: item.address || (poi ? poi.address : undefined),
                latitude: item.latitude
                  ? Number(item.latitude)
                  : poi?.latitude
                    ? Number(poi.latitude)
                    : undefined,
                longitude: item.longitude
                  ? Number(item.longitude)
                  : poi?.longitude
                    ? Number(poi.longitude)
                    : undefined,
                rating: item.rating
                  ? Number(item.rating)
                  : poi?.rating
                    ? Number(poi.rating)
                    : undefined,
                reviewCount: item.reviewCount || poi?.reviewCounts,
                googlePlaceId: item.googlePlaceId || (poi ? poi.googlePlaceId : undefined),
                poiId: item.poiId,
              };
            })
        : [],
    }));
  }

  if (mapped.budget) {
    mapped.budget = Number(mapped.budget).toString();
    mapped.totalBudget = Number(mapped.budget);
  }

  const manualExpensesAmount = mapped.expenses
    ? mapped.expenses
        .filter((e: any) => !e.activityId)
        .reduce((sum: number, e: any) => sum + e.amount, 0)
    : 0;
  mapped.spentAmount = totalActivityCost + manualExpensesAmount;

  mapped.id = (trip.tripId || "").toString();
  mapped.destinationId = (trip.destinationId || "").toString();

  return mapped;
}
