import { validationResult } from 'express-validator';
import {
  listLeads,
  createManualLead,
  updateLead,
  deleteLead,
} from '../leadRepository.js';

const badRequest = (res, errors) =>
  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map((e) => ({ path: e.path || e.param, msg: e.msg })),
  });

export const getLeads = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  try {
    const data = await listLeads({
      status: req.query.status || undefined,
      source: req.query.source || undefined,
      limit: req.query.limit || undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[leads] не удалось получить список:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to load leads' });
  }
};

export const postLead = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  try {
    const { name, contactMethod, contactValue, message, note } = req.body;
    const lead = await createManualLead({
      name: name.trim(),
      contactMethod,
      contactValue: contactValue.trim(),
      message: (message ?? '').trim(),
      note: (note ?? '').trim(),
    });
    return res.status(201).json({ success: true, data: lead });
  } catch (error) {
    console.error('[leads] не удалось создать клиента:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
};

export const patchLead = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  try {
    const lead = await updateLead(req.params.id, {
      status: req.body.status,
      note: req.body.note,
    });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    return res.json({ success: true, data: lead });
  } catch (error) {
    console.error('[leads] не удалось обновить клиента:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
};

export const removeLead = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  try {
    const deleted = await deleteLead(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Lead not found' });
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('[leads] не удалось удалить клиента:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
};
