# Copyright (c) 2026, Diwakar and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class DeliveryRoutePlan(Document):
	pass


from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
